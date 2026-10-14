// Opens a test-only terminal, checks TTY handles, and exits the test shell normally.
// Never starts an AI agent or reads user notes.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildWindowsScript, launchWindowsTerminal } from '../src/terminal';

async function main(): Promise<void> {
if (process.platform !== 'win32') throw new Error('This interactive smoke check is for Windows.');
const dir = await mkdtemp(path.join(tmpdir(), 'zagent-tty-'));
try {
  const capture = path.join(dir, 'tty.cjs');
  const output = path.join(dir, 'result.json');
  await writeFile(capture, `require('node:fs').writeFileSync(process.argv[2],JSON.stringify({stdin:!!process.stdin.isTTY,stdout:!!process.stdout.isTTY,stderr:!!process.stderr.isTTY}));`);
  const script = path.join(dir, 'launch.ps1');
  await writeFile(script, buildWindowsScript({ command: process.execPath, args: [capture, output], cwd: dir, title: 'ZAgent TTY verification' }) + '\n$host.SetShouldExit(0)\n');
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  await launchWindowsTerminal(shell, script, dir);
  let result: {stdin:boolean;stdout:boolean;stderr:boolean} | undefined;
  for (let i = 0; i < 80; i++) {
    try { result = JSON.parse(await readFile(output, 'utf8')); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!result) throw new Error('Test terminal did not report a result.');
  console.log(JSON.stringify(result));
  if (!result.stdin || !result.stdout || !result.stderr) throw new Error('Terminal must provide interactive TTY handles.');
} finally { await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
