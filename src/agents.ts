import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { agentDefinitions, type AgentDefinition, type ZAgentSettings } from './core';

export interface DetectedAgent extends AgentDefinition { executable: string | null; error?: string }
export interface Invocation { command: string; args: string[] }

function commonDirectories(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const home = homedir();
  return platform === 'win32'
    ? [path.join(home, '.local', 'bin'), path.join(home, 'scoop', 'shims'), ...(env.APPDATA ? [path.join(env.APPDATA, 'npm')] : []), ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links')] : [])]
    : [path.join(home, '.local', 'bin'), path.join(home, '.npm-global', 'bin'), path.join(home, '.opencode', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
}

async function isExecutable(file: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    await access(file, platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch { return false; }
}

export async function findExecutable(command: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, extraDirs = commonDirectories(platform, env)): Promise<string | null> {
  command = command.trim().replace(/^"(.*)"$/, '$1');
  if (!command || command.includes('\0')) return null;
  if (command.startsWith('~/') || command.startsWith('~\\')) command = path.join(homedir(), command.slice(2));
  if (path.isAbsolute(command) || path.win32.isAbsolute(command)) return await isExecutable(command, platform) ? command : null;
  if (/[\\/]/.test(command)) return null;
  const pathValue = env.PATH ?? env.Path ?? '';
  const dirs = [...new Set([...pathValue.split(platform === 'win32' ? ';' : ':'), ...extraDirs].filter(Boolean))];
  const extensions = platform === 'win32' && !path.extname(command) ? ['.exe', '.com', '.ps1', '.cmd', '.bat', ''] : [''];
  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = path.join(dir.replace(/^"(.*)"$/, '$1'), command + extension);
      if (await isExecutable(candidate, platform)) return candidate;
    }
  }
  return null;
}

export async function detectAgents(settings: ZAgentSettings): Promise<DetectedAgent[]> {
  return Promise.all(agentDefinitions(settings).map(async agent => {
    const command = settings.agents[agent.id]?.command.trim() || agent.command;
    try { return { ...agent, executable: await findExecutable(command) }; }
    catch (error) { return { ...agent, executable: null, error: String(error) }; }
  }));
}

// Resolve npm shims to their actual executable to keep prompts out of cmd.exe.
export async function resolveInvocation(executable: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<Invocation> {
  const extension = path.extname(executable).toLowerCase();
  if (!['.cmd', '.bat', '.ps1'].includes(extension)) return { command: executable, args };
  const ps1 = executable.replace(/\.(cmd|bat)$/i, '.ps1');
  let contents = '';
  try { contents = await readFile(ps1, 'utf8'); } catch { /* Not an npm shim. */ }
  const match = contents.match(/["']\$basedir[\\/](node_modules[\\/][^"']+)["']\s+\$args/);
  if (match?.[1]) {
    const target = path.resolve(path.dirname(executable), match[1].replace(/[\\/]/g, path.sep));
    const relative = path.relative(path.dirname(executable), target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(target)).isFile()) throw new Error('Agent 启动脚本路径无效。');
    if (/\.exe$/i.test(target)) return { command: target, args };
    if (/\.(m?js|cjs)$/i.test(target)) {
      const localNode = path.join(path.dirname(executable), 'node.exe');
      const node = await isExecutable(localNode, 'win32') ? localNode : await findExecutable('node', env, 'win32');
      if (!node) throw new Error('此 Agent 需要 Node.js，请安装 Node.js 或配置原生可执行文件路径。');
      return { command: node, args: [target, ...args] };
    }
  }
  if (extension === '.ps1') {
    const payload = Buffer.from(JSON.stringify({ executable, args }), 'utf8').toString('base64');
    const code = `$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json; $a = @($p.args); & $p.executable @a; exit $LASTEXITCODE`;
    const shell = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return { command: shell, args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')] };
  }
  throw new Error('无法安全解析这个 .cmd/.bat 启动器。请在设置中指定 Agent 的 .exe、.ps1 或标准 npm 启动器。');
}
