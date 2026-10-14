import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('plugin registers note menus and saves the note before handing off to an interactive CLI', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zagent-plugin-'));
  try {
    const bundle = path.join(root, 'plugin.cjs');
    await build({
      stdin: { contents: `export {default as ZAgent} from './src/main'; export * as host from 'obsidian';`, resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, platform: 'node', format: 'cjs', outfile: bundle,
      plugins: [{ name: 'host-fixture', setup(api) {
        api.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' }));
        api.onLoad({ filter: /^obsidian$/, namespace: 'fixture' }, () => ({ contents: `
          export const events={}; export const commands=[]; export const notices=[];
          export class FileSystemAdapter { constructor(root){this.root=root} getBasePath(){return this.root} }
          export class TFile { constructor(path){this.path=path;this.extension=path.split('.').pop();this.basename=path.replace(/\\.md$/,'');} }
          export class MarkdownView { constructor(file){this.file=file;this.saved=false} async save(){this.saved=true} }
          export class Plugin { async loadData(){return null} async saveData(data){this.data=data} registerEvent(){} addCommand(command){commands.push(command)} addRibbonIcon(){} addSettingTab(){} }
          export class PluginSettingTab {} export class Modal {} export class App {} export class ButtonComponent {} export class Setting {}
          export class Notice {constructor(text){notices.push(text)}} export function setIcon(){}
        ` }));
        api.onResolve({ filter: /^\.\/terminal$/ }, () => ({ path: 'terminal', namespace: 'fixture' }));
        api.onLoad({ filter: /^terminal$/, namespace: 'fixture' }, () => ({ contents: `export async function launchTerminal(payload){globalThis.zagentTestCapture(payload)}` }));
      } }],
    });
    const { ZAgent, host } = createRequire(import.meta.url)(bundle);
    const file = new host.TFile('当前 笔记.md');
    await writeFile(path.join(root, file.path), '# current');
    const view = new host.MarkdownView(file);
    const plugin = new ZAgent();
    const events: Record<string, (...args: any[]) => void> = {};
    plugin.app = {
      vault: { adapter: new host.FileSystemAdapter(root), getAbstractFileByPath: (name: string) => name === file.path ? file : null },
      workspace: { on: (name: string, callback: (...args: any[]) => void) => { events[name] = callback; }, getActiveFile: () => file, getLeavesOfType: () => [{ view }] },
    };
    await plugin.onload();
    const opened: any[] = [];
    plugin.openComposer = (target: any, task: any) => opened.push({ target, task });
    const items: any[] = [];
    const menu = { addItem: (callback: (item: any) => void) => {
      const item = { title: '', click: () => {}, setTitle(title: string){this.title=title;return this}, setIcon(){return this}, onClick(callback:()=>void){this.click=callback;return this} };
      callback(item);items.push(item);
    } };
    events['file-menu']!(menu, file);
    assert.match(items[0].title, /ZAgent/);
    items[0].click();assert.equal(opened[0].target, file);
    events['file-menu']!(menu, new host.TFile('image.png'));
    assert.equal(items.length, 1);
    events['editor-menu']!(menu, {}, {file});assert.equal(items.length, 2);
    assert.equal(host.commands.length, 5);
    host.commands.find((command: any) => command.id === 'task-layout').checkCallback(false);
    assert.equal(opened[1].task.id, 'layout');
    let captured: any;
    (globalThis as any).zagentTestCapture = (payload: any) => { assert.equal(view.saved, true); captured = payload; };
    await plugin.launch(file, {id:'claude', name:'Claude Code', command:'claude', executable:process.execPath}, '只检查，不修改');
    assert.equal(captured.cwd, root);
    assert.equal(captured.args[0], '--');
    assert.ok(captured.args[1].includes(path.join(root, file.path)));
    assert.ok(captured.args[1].includes('只检查，不修改'));
    assert.equal(await readFile(path.join(root, file.path), 'utf8'), '# current');
    assert.equal(plugin.settings.preferredAgent, 'claude');
    // A missing file must fail before opening another terminal.
    plugin.app.vault.getAbstractFileByPath = () => null;
    await assert.rejects(plugin.launch(file, {id:'claude',executable:process.execPath}, '检查'), /删除或移动/);
  } finally {
    delete (globalThis as any).zagentTestCapture;
    await rm(root, { recursive: true, force: true });
  }
});
