import path from 'node:path';

export interface AgentDefinition { id: string; name: string; command: string; promptFlag?: string }
export interface QuickTask { id: string; name: string; icon: string; prompt: string }
export interface AgentConfig { command: string; args: string }
export interface ZAgentSettings {
  preferredAgent: string;
  agents: Record<string, AgentConfig>;
  customName: string;
  customCommand: string;
  customArgs: string;
  customPromptFlag: string;
  terminalPath: string;
}

export const AGENTS: AgentDefinition[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude' },
  { id: 'codex', name: 'Codex', command: 'codex' },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini', promptFlag: '--prompt-interactive' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', promptFlag: '--prompt' },
];

export const TASKS: QuickTask[] = [
  { id: 'improve', name: '优化内容', icon: 'wand-sparkles', prompt: '请优化这篇笔记的表达、逻辑与可读性，保留原意和个人语气，不编造事实。修改前先说明计划，再按 CLI 的权限设置执行。' },
  { id: 'layout', name: '只调整排版', icon: 'pilcrow', prompt: '只调整 Markdown 排版与布局，不改写、增加或删除正文内容与事实。可以规范标题层级、段落间距、列表缩进和表格对齐。保留 YAML frontmatter、双向链接、嵌入、标签、代码块内容与引用。先说明计划，再按 CLI 的权限设置执行。' },
  { id: 'proofread', name: '检查错别字', icon: 'spell-check', prompt: '请检查并修正错别字、标点和明显语病，保留原意、结构及写作风格。不要扩写，不修改代码与链接，先列出问题，再按 CLI 的权限设置执行。' },
  { id: 'summary', name: '提炼摘要', icon: 'list', prompt: '请阅读这篇笔记，在终端中提炼简短摘要与关键要点，不修改原文件。' },
];

export const DEFAULT_SETTINGS: ZAgentSettings = {
  preferredAgent: 'claude', agents: {}, customName: '自定义 Agent',
  customCommand: '', customArgs: '[]', customPromptFlag: '', terminalPath: '',
};

export function agentDefinitions(settings: ZAgentSettings): AgentDefinition[] {
  return settings.customCommand.trim()
    ? [...AGENTS, { id: 'custom', name: settings.customName.trim() || '自定义 Agent', command: settings.customCommand.trim(), promptFlag: settings.customPromptFlag.trim() || undefined }]
    : AGENTS;
}

export function resolveNotePath(vault: string, note: string, platform: NodeJS.Platform = process.platform): string {
  const api = platform === 'win32' ? path.win32 : path.posix;
  const absolute = api.resolve(vault, note);
  const relative = api.relative(vault, absolute);
  if (api.isAbsolute(note) || relative === '..' || relative.startsWith(`..${api.sep}`) || api.isAbsolute(relative)) {
    throw new Error('目标文件必须位于当前笔记库内。');
  }
  return absolute;
}

export function buildPrompt(absolutePath: string, instruction: string): string {
  if (!instruction.trim()) throw new Error('请填写指令，或选择一个快捷操作。');
  return `当前 Obsidian 笔记的绝对路径：\n${absolutePath}\n\n请先读取这个文件，再处理下面的请求。保留 Obsidian 的 YAML frontmatter、[[双向链接]]、![[嵌入]]、标签和代码块，除非用户明确要求修改。只处理这个目标文件；未要求修改文件时，仅在终端回答。\n\n用户请求：\n${instruction.trim()}`;
}

export function parseExtraArgs(json: string): string[] {
  let value: unknown;
  try { value = JSON.parse(json.trim() || '[]'); }
  catch { throw new Error('启动参数必须是 JSON 数组，例如 ["--model", "sonnet"]。'); }
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string' && !v.includes('\0'))) {
    throw new Error('启动参数必须是字符串数组，且不能包含空字符。');
  }
  return value;
}

export function buildAgentArgs(agent: AgentDefinition, extra: string[], prompt: string): string[] {
  return agent.promptFlag ? [...extra, agent.promptFlag, prompt] : [...extra, '--', prompt];
}
