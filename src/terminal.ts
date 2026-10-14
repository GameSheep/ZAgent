import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findExecutable, type Invocation } from './agents';

export interface TerminalPayload extends Invocation { cwd: string; title: string }
const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

export function buildWindowsScript(payload: TerminalPayload): string {
  // ProcessStartInfo bypasses cmd.exe. Quote follows Windows argv rules, including
  // embedded quotes and trailing backslashes, rather than PowerShell 5 coercion.
  return `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${base64(JSON.stringify(payload))}')) | ConvertFrom-Json
try {
  $self = $PSCommandPath
  [IO.File]::Delete($self)
  [IO.Directory]::Delete([IO.Path]::GetDirectoryName($self))
} catch { }
try {
  Add-Type -TypeDefinition @'
using System;
using System.Text;
public static class ZAgentArgv {
  public static string Quote(string value) {
    var result = new StringBuilder("\\\"");
    int slashes = 0;
    foreach (char ch in value) {
      if (ch == '\\\\') { slashes++; continue; }
      if (ch == '"') {
        result.Append('\\\\', slashes * 2 + 1); result.Append('"');
      } else {
        result.Append('\\\\', slashes); result.Append(ch);
      }
      slashes = 0;
    }
    result.Append('\\\\', slashes * 2); result.Append('"');
    return result.ToString();
  }
}
'@
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = [string]$p.command
  $start.WorkingDirectory = [string]$p.cwd
  $start.UseShellExecute = $false
  $start.Arguments = (@($p.args | ForEach-Object { [ZAgentArgv]::Quote([string]$_) }) -join ' ')
  Write-Host ('ZAgent | ' + $p.title) -ForegroundColor Cyan
  $process = [Diagnostics.Process]::Start($start)
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { Write-Host ('Agent exited with code ' + $process.ExitCode) -ForegroundColor Yellow }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
`;
}

export function buildPosixScript(payload: TerminalPayload): string {
  const decode = (value: string) => `"$(decode '${base64(value)}'; printf '.')"`;
  // Appending/removing a sentinel preserves trailing newlines in arguments.
  const variables = [payload.command, ...payload.args].map((arg, i) => `a${i}=${decode(arg)}\na${i}=\${a${i}%.}`).join('\n');
  return `#!/bin/sh
decode() { if [ "$(uname -s)" = Darwin ]; then printf '%s' "$1" | base64 -D; else printf '%s' "$1" | base64 -d; fi; }
cwd=${decode(payload.cwd)}
cwd=\${cwd%.}
cd "$cwd" || exit 1
rm -f -- "$0"
rmdir -- "$(dirname "$0")" 2>/dev/null || true
${variables}
exec ${[payload.command, ...payload.args].map((_, i) => `"$a${i}"`).join(' ')}
`;
}

function startDetached(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false, shell: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export async function launchWindowsTerminal(shell: string, script: string, cwd: string): Promise<void> {
  // A detached Node child with ignored stdio cannot provide a reliable Windows
  // console. Let ShellExecute create the interactive console and its TTY handles.
  const entry = Buffer.from(`& '${script.replace(/'/g, "''")}'`, 'utf16le').toString('base64');
  const data = base64(JSON.stringify({ shell, cwd, args: `-NoProfile -NoExit -ExecutionPolicy Bypass -EncodedCommand ${entry}` }));
  const broker = `$ErrorActionPreference = 'Stop'
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = $p.shell
$start.Arguments = $p.args
$start.WorkingDirectory = $p.cwd
$start.UseShellExecute = $true
$start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Normal
[Diagnostics.Process]::Start($start) | Out-Null`;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(shell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(broker, 'utf16le').toString('base64')], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, shell: false });
    let error = '';
    child.stderr.on('data', chunk => { error += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(error || '无法打开 PowerShell 终端。')));
  });
}

export async function launchTerminal(payload: TerminalPayload, terminalOverride = ''): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), 'zagent-'));
  const script = path.join(dir, process.platform === 'win32' ? 'launch.ps1' : 'launch.sh');
  try {
    await writeFile(script, process.platform === 'win32' ? buildWindowsScript(payload) : buildPosixScript(payload), { encoding: 'utf8', mode: 0o700 });
    if (process.platform === 'win32') {
      const shell = terminalOverride.trim() || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const terminal = await findExecutable(shell);
      if (!terminal) throw new Error('找不到 PowerShell，请在 ZAgent 设置中配置 powershell.exe 或 pwsh.exe 的路径。');
      await launchWindowsTerminal(terminal, script, payload.cwd);
    } else if (process.platform === 'darwin') {
      const shellCommand = `/bin/sh '${script.replace(/'/g, "'\\''")}'`;
      const appleString = JSON.stringify(shellCommand);
      await new Promise<void>((resolve, reject) => {
        const child = spawn('/usr/bin/osascript', ['-e', `tell application "Terminal"\nactivate\ndo script ${appleString}\nend tell`], { stdio: ['ignore', 'ignore', 'pipe'] });
        let error = '';
        child.stderr.on('data', chunk => { error += String(chunk); });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(error || '无法打开 Terminal。')));
      });
    } else {
      const candidates = terminalOverride.trim() ? [terminalOverride.trim()] : ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
      let terminal: string | null = null;
      for (const candidate of candidates) { terminal = await findExecutable(candidate); if (terminal) break; }
      if (!terminal) throw new Error('找不到终端，请在 ZAgent 设置中指定终端路径。');
      const name = path.basename(terminal);
      const args = name === 'gnome-terminal' ? ['--', '/bin/sh', script] : name === 'xfce4-terminal' ? ['-x', '/bin/sh', script] : ['-e', '/bin/sh', script];
      await startDetached(terminal, args, payload.cwd);
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}
