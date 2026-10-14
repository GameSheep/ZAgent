import { FileSystemAdapter, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { stat } from 'node:fs/promises';
import { DEFAULT_SETTINGS, TASKS, buildAgentArgs, buildPrompt, parseExtraArgs, resolveNotePath, type QuickTask, type ZAgentSettings } from './core';
import { resolveInvocation, type DetectedAgent } from './agents';
import { launchTerminal } from './terminal';
import { AgentComposer } from './ui';
import { ZAgentSettingTab } from './settings';

export default class ZAgentPlugin extends Plugin {
  settings: ZAgentSettings = { ...DEFAULT_SETTINGS, agents: {} };
  private composers = new Set<AgentComposer>();

  async onload(): Promise<void> {
    const saved = await this.loadData() as Partial<ZAgentSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved, agents: saved?.agents ?? {} };
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      new Notice('ZAgent 仅支持桌面版 Obsidian 的本地笔记库。');
      return;
    }
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') return;
      menu.addItem(item => item.setTitle('ZAgent：打开本机 AI Agent').setIcon('terminal').onClick(() => this.openComposer(file)));
    }));
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, _editor, info) => {
      if (!info.file || info.file.extension.toLowerCase() !== 'md') return;
      const file = info.file;
      menu.addItem(item => item.setTitle('ZAgent：打开本机 AI Agent').setIcon('terminal').onClick(() => this.openComposer(file)));
    }));
    this.addCommand({
      id: 'open-agent', name: '打开本机 AI Agent',
      checkCallback: checking => this.currentNoteCommand(checking),
    });
    for (const task of TASKS) {
      this.addCommand({ id: `task-${task.id}`, name: task.name, checkCallback: checking => this.currentNoteCommand(checking, task) });
    }
    this.addRibbonIcon('terminal', 'ZAgent：打开本机 AI Agent', () => {
      const file = this.app.workspace.getActiveFile();
      if (file?.extension.toLowerCase() === 'md') this.openComposer(file);
      else new Notice('请先打开一篇 Markdown 笔记。');
    });
    this.addSettingTab(new ZAgentSettingTab(this.app, this));
  }

  onunload(): void { for (const composer of this.composers) composer.close(); }

  private currentNoteCommand(checking: boolean, task?: QuickTask): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension.toLowerCase() !== 'md') return false;
    if (!checking) this.openComposer(file, task);
    return true;
  }

  openComposer(file: TFile, task?: QuickTask): void {
    const modal = new AgentComposer(this.app, this, file, task);
    this.composers.add(modal);
    modal.onDisposed = () => this.composers.delete(modal);
    modal.open();
  }

  notePath(file: TFile): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error('需要桌面版的本地笔记库。');
    return resolveNotePath(adapter.getBasePath(), file.path);
  }

  async launch(file: TFile, agent: DetectedAgent, instruction: string): Promise<void> {
    if (!agent.executable) throw new Error('未找到这个 Agent。请安装后重新检测，或在设置中指定可执行文件。');
    if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error('这篇笔记已被删除或移动，请重新打开 ZAgent。');
    // Flush Obsidian's debounced editor save before another process reads it.
    const view = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .find(view => view instanceof MarkdownView && view.file === file);
    if (view instanceof MarkdownView) await view.save();
    const absolutePath = this.notePath(file);
    if (!(await stat(absolutePath)).isFile()) throw new Error('笔记文件不存在，请保存后重试。');
    const extra = parseExtraArgs(agent.id === 'custom' ? this.settings.customArgs : this.settings.agents[agent.id]?.args ?? '[]');
    const invocation = await resolveInvocation(agent.executable, buildAgentArgs(agent, extra, buildPrompt(absolutePath, instruction)));
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    await launchTerminal({ ...invocation, cwd: adapter.getBasePath(), title: `${agent.name} · ${file.basename}` }, this.settings.terminalPath);
    this.settings.preferredAgent = agent.id;
    // Terminal launch succeeded even if preference persistence is unavailable.
    try { await this.saveSettings(); } catch { new Notice('终端已打开，但未能保存默认 Agent。'); }
  }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}
