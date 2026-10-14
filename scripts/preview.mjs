// Development-only browser harness for the actual Obsidian composer component.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

await mkdir('.preview', { recursive: true });
await build({ entryPoints: ['src/agents.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: '.preview/agents.cjs' });
const require = createRequire(import.meta.url);
const { detectAgents } = require(path.resolve('.preview/agents.cjs'));
const agents = await detectAgents({ agents: {}, customCommand: '' });
await build({
  stdin: { contents: `import { AgentComposer } from './src/ui';
const plugin = { settings: { preferredAgent: 'claude' }, notePath: () => 'E:\\\\Obsidian\\\\我的笔记\\\\产品设计.md', launch: async (file,agent,instruction) => { window.lastLaunch = { file,agent,instruction }; await new Promise(r=>setTimeout(r,200)); } };
const open = () => new AgentComposer({}, plugin, {name:'产品设计.md',basename:'产品设计',path:'产品设计.md'}).open();
document.querySelector('#open').onclick = open;
document.querySelector('#theme').onclick = () => document.body.classList.toggle('theme-light');
open();`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'browser', outfile: '.preview/app.js',
  plugins: [{ name: 'obsidian-preview', setup(api) {
    api.onResolve({ filter: /^obsidian$/ }, () => ({ path: path.resolve('scripts/preview-obsidian.mjs') }));
    api.onResolve({ filter: /^\.\/agents$/ }, () => ({ path: 'agents-preview', namespace: 'preview' }));
    api.onLoad({ filter: /^agents-preview$/, namespace: 'preview' }, () => ({ contents: `export async function detectAgents(){return ${JSON.stringify(agents)}}` }));
    api.onResolve({ filter: /^node:path$/ }, () => ({ path: 'path-preview', namespace: 'preview' }));
    api.onLoad({ filter: /^path-preview$/, namespace: 'preview' }, () => ({ contents: 'export default {};' }));
  } }],
});
await writeFile('.preview/index.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZAgent · 开发预览</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/styles.css"><body><main class="preview-note"><p class="preview-label">ZAgent 开发预览 · 使用实际插件组件，非 Obsidian 宿主</p><h1>产品设计</h1><p>把笔记交给你熟悉的本机 Agent，继续思考。</p><button id="open">打开 ZAgent</button> <button id="theme">切换主题</button></main><script src="/app.js"></script></body></html>`);
const routes = { '/': '.preview/index.html', '/app.js': '.preview/app.js', '/base.css': 'scripts/preview-base.css', '/styles.css': 'styles.css' };
createServer(async (request, response) => {
  const file = routes[request.url];
  if (!file) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
  response.end(await readFile(file));
}).listen(4173, '127.0.0.1', () => console.log('ZAgent preview: http://127.0.0.1:4173'));
