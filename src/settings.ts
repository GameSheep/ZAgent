import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { AGENTS, parseExtraArgs } from './core';
import { detectAgents } from './agents';
import type ZAgentPlugin from './main';

export class ZAgentSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ZAgentPlugin) { super(app, plugin); }

  display(): void {
    const root = this.containerEl;
    root.empty();
    root.createEl('p', { text: '调用你已经安装并登录的本机 Agent。启动时使用笔记库根目录，自动保存当前笔记并带入绝对路径。' });
    const status = root.createDiv('zagent-settings-status');
    new Setting(root).setName('检测本机 Agent').setDesc('检测 PATH 与常见安装目录；“已检测到”表示找到了文件，不代表已经登录。')
      .addButton(button => button.setButtonText('重新检测').onClick(async () => {
        button.setDisabled(true);
        try {
          const agents = await detectAgents(this.plugin.settings);
          status.empty();
          for (const agent of agents) {
            const line = status.createDiv();
            line.createEl('strong', { text: `${agent.name}：` });
            line.createSpan({ text: agent.executable ?? '未找到，请指定路径或安装 CLI。' });
          }
        } catch (error) { new Notice(String(error)); }
        finally { button.setDisabled(false); }
      }));
    for (const agent of AGENTS) {
      new Setting(root).setName(agent.name).setHeading();
      const config = this.plugin.settings.agents[agent.id] ?? { command: '', args: '[]' };
      this.plugin.settings.agents[agent.id] = config;
      new Setting(root).setName('可执行文件路径').setDesc('留空自动检测。只填写命令名或完整路径，不要拼接参数。')
        .addText(text => text.setPlaceholder(agent.command).setValue(config.command).onChange(async value => { config.command = value; await this.persist(); }));
      new Setting(root).setName('额外参数').setDesc('JSON 字符串数组，例如 ["--model", "sonnet"]。')
        .addText(text => text.setPlaceholder('[]').setValue(config.args).onChange(async value => {
          try { parseExtraArgs(value); text.inputEl.removeAttribute('aria-invalid'); }
          catch { text.inputEl.setAttribute('aria-invalid', 'true'); }
          config.args = value; await this.persist();
        }));
    }
    new Setting(root).setName('自定义 Agent').setHeading();
    this.textSetting('显示名称', '在 Agent 列表中显示的名字。', 'customName', '自定义 Agent');
    this.textSetting('命令或可执行文件路径', '填写后出现在列表中，留空隐藏。支持接收提示词参数的交互式 CLI。', 'customCommand', 'my-agent');
    this.textSetting('额外参数', 'JSON 数组；提示词会作为一个独立参数追加。', 'customArgs', '[]');
    this.textSetting('提示词参数名', '留空使用位置参数（-- 后追加）；有些 Agent 需要 --prompt 或 -i。', 'customPromptFlag', '--prompt');
    new Setting(root).setName('终端').setHeading();
    this.textSetting('终端可执行文件', 'Windows：powershell.exe 或 pwsh.exe。Linux：xterm、konsole、gnome-terminal 等。留空自动选择。macOS 使用系统 Terminal。', 'terminalPath', '自动选择');
    root.createEl('p', { text: '快捷操作只是提示词模板，具体修改行为由 Agent 决定。ZAgent 不添加跳过权限检查的启动参数。', cls: 'setting-item-description' });
  }

  private textSetting(name: string, description: string, key: 'customName' | 'customCommand' | 'customArgs' | 'customPromptFlag' | 'terminalPath', placeholder: string): void {
    new Setting(this.containerEl).setName(name).setDesc(description)
      .addText(text => text.setPlaceholder(placeholder).setValue(this.plugin.settings[key]).onChange(async value => { this.plugin.settings[key] = value; await this.persist(); }));
  }

  private async persist(): Promise<void> {
    try { await this.plugin.saveSettings(); }
    catch { new Notice('ZAgent 设置保存失败，请检查笔记库写入权限。'); }
  }
}
