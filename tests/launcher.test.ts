import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildWindowsScript, buildPosixScript } from '../src/terminal';

test('real shell preserves exact argv and cwd without executing prompt text', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zagent-argv-'));
  const run = promisify(execFile);
  try {
    const workspace = path.join(root, '笔记 库');
    const launchDir = path.join(root, 'launcher');
    await mkdir(workspace); await mkdir(launchDir);
    const capture = path.join(root, 'capture.cjs');
    const output = path.join(root, 'captured.json');
    await writeFile(capture, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify({args:process.argv.slice(3),cwd:process.cwd()}))');
    const args = ['', '中文 文件.md', 'line one\nline two\n', 'quote " and \\\" and slash\\', '& echo INJECTED; $(echo oops)', "single ' quote", '`backticks` %PATH% !'];
    const payload = { command: process.execPath, args: [capture, output, ...args], cwd: workspace, title: 'ZAgent smoke test' };
    const script = path.join(launchDir, process.platform === 'win32' ? 'launch.ps1' : 'launch.sh');
    await writeFile(script, process.platform === 'win32' ? buildWindowsScript(payload) : buildPosixScript(payload));
    const shell = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '/bin/sh';
    const shellArgs = process.platform === 'win32' ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script] : [script];
    await run(shell, shellArgs, { timeout: 20000, windowsHide: true });
    const result = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(result.args, args);
    assert.equal(result.cwd, workspace);
  } finally { await rm(root, { recursive: true, force: true }); }
});
