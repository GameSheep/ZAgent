import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPrompt, resolveNotePath, TASKS, AGENTS, buildAgentArgs, parseExtraArgs } from '../src/core';
import { findExecutable, resolveInvocation } from '../src/agents';
import { buildWindowsScript, buildPosixScript } from '../src/terminal';

test('prompt always contains the absolute target and preserves the user instruction', () => {
  const file = 'E:\\笔记 库\\产品设计.md';
  const prompt = buildPrompt(file, '保留 "引号"、$变量 与 `代码`，优化第二段。');
  assert.ok(prompt.includes(file));
  assert.ok(prompt.includes('保留 "引号"、$变量 与 `代码`，优化第二段。'));
  assert.ok(prompt.includes('[[双向链接]]'));
  assert.throws(() => buildPrompt(file, '  '), /指令/);
});

test('note resolution supports Chinese/spaces and rejects escaping the vault', () => {
  assert.equal(resolveNotePath('E:\\笔记 库', '专题/草稿.md', 'win32'), 'E:\\笔记 库\\专题\\草稿.md');
  assert.equal(resolveNotePath('/home/me/notes', '草稿.md', 'linux'), '/home/me/notes/草稿.md');
  assert.throws(() => resolveNotePath('/notes', '../outside.md', 'linux'), /笔记库/);
  assert.throws(() => resolveNotePath('/notes', '/outside.md', 'linux'), /笔记库/);
});

test('layout-only task explicitly preserves content and Obsidian syntax', () => {
  const task = TASKS.find(task => task.id === 'layout')!;
  assert.match(task.prompt, /不.*(改|增|删)/);
  assert.match(task.prompt, /frontmatter|YAML/);
  assert.match(task.prompt, /双向链接/);
});

test('interactive arguments are correct and custom arguments are data', () => {
  const prompt = '目标文件：/notes/test.md\n检查 "文字" & $(echo nope)';
  assert.deepEqual(buildAgentArgs(AGENTS[0]!, ['--model', 'sonnet'], prompt), ['--model', 'sonnet', '--', prompt]);
  assert.deepEqual(buildAgentArgs(AGENTS.find(a => a.id === 'gemini')!, [], prompt), ['--prompt-interactive', prompt]);
  assert.deepEqual(buildAgentArgs(AGENTS.find(a => a.id === 'opencode')!, [], prompt), ['--prompt', prompt]);
  assert.deepEqual(parseExtraArgs('["--model", "my model"]'), ['--model', 'my model']);
  assert.throws(() => parseExtraArgs('--model abc'), /JSON/);
  assert.throws(() => parseExtraArgs('[1]'), /字符串/);
});

test('discovery searches configured PATH and ignores directories', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zagent-test-'));
  try {
    await mkdir(path.join(root, 'claude'));
    const cli = path.join(root, process.platform === 'win32' ? 'codex.exe' : 'codex');
    await writeFile(cli, '#!/bin/sh\n', { mode: 0o700 });
    assert.equal(await findExecutable('codex', { PATH: root }, process.platform, []), cli);
    assert.equal(await findExecutable('claude', { PATH: root }, process.platform, []), null);
    assert.equal(await findExecutable('missing-agent', { PATH: root }, process.platform, []), null);
    assert.equal(await findExecutable(cli, { PATH: '' }, process.platform, []), cli);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('npm PowerShell shim resolves to a direct executable without shell reparsing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zagent-shim-'));
  try {
    const target = path.join(root, 'node_modules', 'agent', 'cli.js');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, '');
    await writeFile(path.join(root, 'node.exe'), '');
    const shim = path.join(root, 'agent.ps1');
    await writeFile(shim, '& "$basedir/node.exe" "$basedir/node_modules/agent/cli.js" $args');
    const result = await resolveInvocation(shim, ['hello "world"'], { PATH: root });
    assert.equal(result.command, path.join(root, 'node.exe'));
    assert.deepEqual(result.args, [target, 'hello "world"']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('terminal scripts keep hostile text in a base64 payload, outside shell code', () => {
  const payload = { command: 'C:\\Program Files\\agent.exe', args: ['" & echo INJECTED; $(echo oops)\n中文'], cwd: 'E:\\笔记 库', title: 'ZAgent' };
  const win = buildWindowsScript(payload);
  assert.ok(!win.includes(payload.args[0]!));
  assert.match(win, /FromBase64String/);
  assert.match(win, /ProcessStartInfo/);
  const unix = buildPosixScript({ ...payload, command: '/usr/bin/agent', cwd: '/notes' });
  assert.ok(!unix.includes(payload.args[0]!));
  assert.match(unix, /base64/);
  assert.match(unix, /exec /);
});
