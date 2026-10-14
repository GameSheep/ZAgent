import { App, ButtonComponent, Modal, Notice, TFile, setIcon } from 'obsidian';
import { TASKS, buildPrompt, type QuickTask } from './core';
import { detectAgents, type DetectedAgent } from './agents';
import type ZAgentPlugin from './main';

export class AgentComposer extends Modal {
  onDisposed?: () => void;
  private agents: DetectedAgent[] = [];
  private selected = '';
  private active = false;
  private busy = false;
  private scanId = 0;
  private instruction!: HTMLTextAreaElement;
  private agentList!: HTMLElement;
  private executableEl!: HTMLElement;
  private preview!: HTMLElement;
  private errorEl!: HTMLElement;
  private launchButton!: ButtonComponent;
  private refreshButton!: ButtonComponent;

  constructor(app: App, private plugin: ZAgentPlugin, private file: TFile, private task?: QuickTask) { super(app); }

  onOpen(): void {
    this.active = true;
    this.modalEl.addClass('zagent-modal');
    this.titleEl.setText('ZAgent');
    const root = this.contentEl;
    root.addClass('zagent-composer');
    const note = root.createDiv('zagent-note');
    const icon = note.createSpan('zagent-note-icon'); setIcon(icon, 'file-text');
    const noteText = note.createDiv('zagent-note-text');
    noteText.createEl('strong', { text: this.file.name });
    noteText.createEl('code', { text: this.plugin.notePath(this.file), cls: 'zagent-file-path' });

    const agentHeader = root.createDiv('zagent-section-heading');
    agentHeader.createEl('h3', { text: '选择本机 Agent' });
    this.refreshButton = new ButtonComponent(agentHeader).setIcon('refresh-cw').setTooltip('重新检测本机 Agent').onClick(() => { void this.scan(); });
    this.agentList = root.createDiv('zagent-agent-list');
    this.agentList.setAttribute('role', 'radiogroup');
    this.agentList.setAttribute('aria-label', '本机 Agent');
    this.agentList.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const available = this.agents.filter(agent => agent.executable);
      if (!available.length) return;
      event.preventDefault();
      const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
      const index = available.findIndex(agent => agent.id === this.selected);
      this.selectAgent(available[(index + direction + available.length) % available.length]!);
      this.agentList.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    });
    this.executableEl = root.createDiv('zagent-executable');
    this.executableEl.setAttribute('aria-live', 'polite');

    root.createEl('h3', { text: '常用操作', cls: 'zagent-task-heading' });
    const tasks = root.createDiv('zagent-tasks');
    for (const task of TASKS) {
      const button = tasks.createEl('button', { cls: 'zagent-task', attr: { type: 'button', 'aria-pressed': String(this.task?.id === task.id) } });
      setIcon(button.createSpan(), task.icon);
      button.createSpan({ text: task.name });
      button.addEventListener('click', () => {
        this.task = task;
        this.instruction.value = task.prompt;
        this.updateTasks(tasks);
        this.updatePreview();
        this.instruction.focus();
      });
      button.dataset.task = task.id;
    }
    const label = root.createEl('label', { text: '想让 Agent 做什么？', cls: 'zagent-input-label' });
    this.instruction = root.createEl('textarea', { cls: 'zagent-instruction', attr: { rows: '5', placeholder: '例如：帮我重新组织文章结构，保留所有示例和引用。' } });
    this.instruction.id = `zagent-instruction-${Date.now()}`;
    label.htmlFor = this.instruction.id;
    this.instruction.value = this.task?.prompt ?? '';
    this.instruction.addEventListener('input', () => { this.task = undefined; this.updateTasks(tasks); this.updatePreview(); });
    const details = root.createEl('details', { cls: 'zagent-preview' });
    details.createEl('summary', { text: '查看完整提示词（自动包含文件绝对路径）' });
    this.preview = details.createEl('pre');
    this.errorEl = root.createDiv('zagent-error');
    this.errorEl.setAttribute('role', 'alert');
    this.errorEl.hidden = true;
    const footer = root.createDiv('zagent-footer');
    footer.createSpan({ text: '保存笔记后，在终端继续对话', cls: 'zagent-hint' });
    const actions = footer.createDiv('zagent-footer-actions');
    new ButtonComponent(actions).setButtonText('取消').onClick(() => this.close());
    this.launchButton = new ButtonComponent(actions).setButtonText('在终端打开').setCta().setDisabled(true).onClick(() => { void this.launch(); });
    this.launchButton.setTooltip('在终端打开（Ctrl / Cmd + Enter）');
    this.scope.register(['Mod'], 'Enter', () => { void this.launch(); return false; });
    this.updatePreview();
    void this.scan();
    this.instruction.focus();
  }

  private updateTasks(container: HTMLElement): void {
    container.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      const selected = button.dataset.task === this.task?.id;
      button.setAttribute('aria-pressed', String(selected));
      button.toggleClass('is-selected', selected);
    });
  }

  private async scan(): Promise<void> {
    const scanId = ++this.scanId;
    this.refreshButton.setDisabled(true);
    this.agentList.setText('正在检测本机 Agent…');
    try {
      const agents = await detectAgents(this.plugin.settings);
      if (!this.active || scanId !== this.scanId) return;
      this.agents = agents;
      const preferred = this.selected || this.plugin.settings.preferredAgent;
      this.selected = agents.find(a => a.id === preferred && a.executable)?.id ?? agents.find(a => a.executable)?.id ?? '';
      this.renderAgents();
    } catch (error) { if (this.active) this.showError(error); }
    finally { if (this.active && scanId === this.scanId) { this.refreshButton.setDisabled(false); this.updatePreview(); } }
  }

  private renderAgents(): void {
    this.agentList.empty();
    for (const agent of this.agents) {
      const selected = agent.id === this.selected;
      const button = this.agentList.createEl('button', { cls: 'zagent-agent', attr: { type: 'button', role: 'radio', 'aria-checked': String(selected), 'aria-label': `${agent.name}，${agent.executable ? '已检测到' : '未找到'}` } });
      button.disabled = !agent.executable || this.busy;
      button.tabIndex = selected ? 0 : -1;
      button.toggleClass('is-selected', selected);
      button.createSpan({ text: agent.name, cls: 'zagent-agent-name' });
      button.createSpan({ text: agent.executable ? '已检测到' : '未找到', cls: `zagent-agent-status${agent.executable ? ' is-available' : ''}` });
      button.addEventListener('click', () => this.selectAgent(agent));
    }
    const agent = this.agents.find(a => a.id === this.selected);
    this.executableEl.setText(agent?.executable ?? '未找到本机 Agent。请先安装，或在设置 → ZAgent 中填写可执行文件路径，然后重新检测。');
    this.executableEl.title = agent?.executable ?? '';
    this.updatePreview();
  }

  private selectAgent(agent: DetectedAgent): void {
    this.selected = agent.id;
    this.renderAgents();
    this.agentList.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }

  private updatePreview(): void {
    if (!this.preview) return;
    try { this.preview.setText(buildPrompt(this.plugin.notePath(this.file), this.instruction.value)); }
    catch { this.preview.setText(`目标文件：${this.plugin.notePath(this.file)}\n\n填写指令或选择一个常用操作后，将在这里显示完整提示词。`); }
    this.launchButton?.setDisabled(this.busy || !this.selected || !this.instruction.value.trim());
  }

  private showError(error: unknown): void {
    this.errorEl.hidden = false;
    this.errorEl.setText(error instanceof Error ? error.message : String(error));
  }

  private async launch(): Promise<void> {
    if (this.busy || !this.instruction.value.trim()) return;
    const agent = this.agents.find(a => a.id === this.selected && a.executable);
    if (!agent) return;
    this.busy = true;
    this.errorEl.hidden = true;
    this.launchButton.setButtonText('正在打开…');
    this.refreshButton.setDisabled(true);
    this.instruction.disabled = true;
    this.renderAgents();
    try {
      await this.plugin.launch(this.file, agent, this.instruction.value);
      new Notice(`已打开 ${agent.name}，当前笔记路径已带入提示词。`);
      this.close();
    } catch (error) { if (this.active) this.showError(error); }
    finally {
      this.busy = false;
      if (this.active) {
        this.instruction.disabled = false;
        this.refreshButton.setDisabled(false);
        this.launchButton.setButtonText('在终端打开');
        this.renderAgents();
      }
    }
  }

  onClose(): void { this.active = false; this.scanId++; this.contentEl.empty(); this.onDisposed?.(); }
}
