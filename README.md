# ZAgent — Obsidian 本机 AI Agent 启动器

从正在编辑的笔记出发，直接调用本机 Claude Code、Codex、Gemini CLI 或 OpenCode。先在 Obsidian 内写指令，再打开 Agent 的原生交互终端，自动带上当前 Markdown 文件的绝对路径。

[GitHub 仓库](https://github.com/GameSheep/ZAgent) · [下载发布版本](https://github.com/GameSheep/ZAgent/releases)

**社区目录状态：尚未上架，目前不能在 Obsidian 第三方插件搜索中直接安装。** GitHub Release 与 Obsidian 社区目录审核是两个独立步骤，进度与提交流程见 [发布说明](docs/PUBLISHING.md)。

## 安装

1. 从 [Releases](https://github.com/GameSheep/ZAgent/releases) 下载 `zagent-0.1.0.zip` 并解压，把其中的 **`zagent` 文件夹**复制到你的笔记库 `.obsidian/plugins/` 下。
2. 确认结构如下，避免多嵌套一层目录：

   ```text
   你的笔记库/
   └── .obsidian/
       └── plugins/
           └── zagent/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```

3. 重启 Obsidian，进入 **设置 → 第三方插件**，允许第三方插件后启用 **ZAgent**。

也可以新建 `zagent` 文件夹，把 Release 附件中的 `main.js`、`manifest.json` 和 `styles.css` 放入其中。源码构建后也能复制 `dist/zagent/` 文件夹。只支持桌面版 Obsidian，最低版本 1.5.0。不需要把源码、Node.js 或 `node_modules` 复制到插件目录；npm 安装的 Agent 自身可能仍需要 Node.js。

## 使用

1. 打开一篇 `.md` 笔记。
2. 点击笔记右上角 **三个点 → ZAgent：打开本机 AI Agent**。也支持文件列表右键、编辑器右键、左侧终端图标，以及命令面板中的 ZAgent 命令。
3. 选择已检测到的 Agent。插件会记住最近成功启动的选择。
4. 填写你要做的事，或者选择：

   | 操作 | 默认要求 |
   | --- | --- |
   | 优化内容 | 优化表达、逻辑和可读性，保留原意，不编造事实 |
   | 只调整排版 | 调整 Markdown 布局，保留正文、frontmatter、链接、代码和引用 |
   | 检查错别字 | 修正错别字、标点与明显语病，不扩写 |
   | 提炼摘要 | 在终端输出摘要，不修改原文件 |

5. 可以继续编辑快捷操作填入的指令。展开“查看完整提示词”可核对路径和最终发送内容。
6. 点击 **在终端打开**，或按 **Ctrl / Cmd + Enter**。插件先保存当前笔记，再打开终端，以笔记库根目录启动 Agent，并将完整提示词作为初始消息发送。后续输入、登录、授权与对话在 Agent 终端中完成。

插件传入的是文件路径和指令；Agent 自行读取笔记。ZAgent 不会在你的笔记中插入路径或提示词，也不直接替你改写正文。Agent 修改后的文件由 Obsidian 正常同步显示。

## 隐私、文件访问与服务依赖

ZAgent 使用 MIT 许可证，不包含遥测、广告、模型服务或 API Key。插件本身不发起模型网络请求，也不安装或更新 Agent。

为定位已安装的 CLI，插件会检查笔记库以外的 PATH、常见安装目录和你手动指定的可执行文件，并可能读取 npm 的启动包装脚本，以找到实际的程序路径。启动时会在系统临时目录写入包含提示词的短期启动脚本，脚本运行后删除自身；异常退出时可能留下该临时文件。

Claude Code、Codex、Gemini CLI、OpenCode 或自定义 Agent 必须由用户自行安装、配置和登录。是否需要账号、API Key 或付费订阅，取决于选用的 Agent 与服务。Agent 可能把指令及读取的笔记发送给其配置的模型供应商，例如 Anthropic、OpenAI、Google 或自定义服务。请以该 Agent 的配置、服务条款和隐私政策为准。

Agent 按自身的文件权限和工作目录访问文件；提示词中的“只处理目标文件”属于任务约束，不是文件系统沙箱。ZAgent 不替用户批准 Agent 的文件或执行权限。

## Agent 与设置

| Agent | 检测命令 | 交互启动参数 |
| --- | --- | --- |
| Claude Code | `claude` | `-- <完整提示词>` |
| Codex | `codex` | `-- <完整提示词>` |
| Gemini CLI | `gemini` | `--prompt-interactive <完整提示词>` |
| OpenCode | `opencode` | `--prompt <完整提示词>` |

在 **设置 → ZAgent** 中可以重新检测、为每个 Agent 指定路径或增加参数。参数使用 JSON 字符串数组，例如 `["--model", "sonnet"]`。路径与参数分开填写，不要输入 `claude --model sonnet` 作为可执行文件路径。

“自定义 Agent”可以接入其他接收提示词参数的 CLI：填写显示名称、可执行文件、额外参数、可选的提示词参数名。未填写命令时不会显示这一项。

“已检测到”只表示文件存在，不会主动执行 CLI，也不检测账号登录状态。请先在普通终端中完成 Agent 安装和登录。插件本身不需要 API Key；Agent 按其自身配置连接模型服务，读取的笔记内容可能发送给该服务。

### 终端

- **Windows**：默认使用系统 Windows PowerShell，支持指定 `pwsh.exe`。标准 npm 启动器会解析到实际的 Node 脚本或原生程序，避免多层 shell 解释造成中文、引号或多行指令丢失。非标准 `.cmd/.bat` 启动器需改配 `.exe`、`.ps1` 或标准 npm 启动器。
- **macOS**：使用系统 Terminal，首次打开时系统可能询问自动化权限。
- **Linux**：自动寻找 `x-terminal-emulator`、`gnome-terminal`、`konsole`、`xfce4-terminal`、`xterm`，也可手动指定以上兼容终端的路径。

## 常见问题

**终端能运行 Claude，插件却显示未找到？**

Obsidian 的 PATH 可能与交互式终端不同。安装 CLI 后重启 Obsidian，或把 `Get-Command claude`（Windows）、`which claude`（macOS/Linux）查出的完整路径填入设置。通过 nvm、fnm 或自定义 shell 配置安装的工具尤其适合指定路径。常见本地安装目录会额外搜索。

**启动后提示需要登录、工作目录信任或文件修改授权？**

在 Agent 原生界面完成。ZAgent 保留 Agent 自身的权限和信任流程，不自动添加跳过权限检查的参数。

**“只调整排版”能保证一个字也不变吗？**

这是明确限制正文修改的提示词模板，具体执行由 Agent 决定；插件不包含内容差异审查器。可在指令中补充“先展示修改计划或 diff”，并使用笔记历史核对。

**菜单中没有 ZAgent？**

确认插件已启用、目录名为 `zagent` 且三个发布文件位于这一层。入口只在 Markdown 文件上出现。也可以通过命令面板搜索 `ZAgent`，或点击左侧终端图标。

## 开发与验证

```sh
npm install
npm test
npm run test:terminal
npm run build
npm run package
```

`npm run dev` 监听源码改动。`test:terminal` 仅适用于 Windows，会打开一个测试终端，确认真实 TTY 后正常退出。打包需要 Windows PowerShell，或 macOS/Linux 的 `zip` 命令。

`npm run preview` 提供 `http://localhost:4173` 浏览器预览，复用实际的 composer 组件与本机检测结果；这是开发用宿主模拟，启动按钮只演示交互，不实际运行 Agent。

自动化测试覆盖提示词、路径边界、CLI 参数、本机查找、npm 启动器解析、真实系统 shell 的逐字参数传递，以及模拟 Obsidian 宿主中的菜单与保存/启动流程。Windows PowerShell 已实测，并通过新控制台中 stdin/stdout/stderr 均为 TTY 的验证；macOS/Linux 启动入口与真实 Obsidian 内的完整交互仍需各平台验收。开发测试不会向真实 Agent 提交任务，也不消耗模型额度。

实现参考：[Obsidian 官方 API](https://github.com/obsidianmd/obsidian-api)、[Claude CLI](https://code.claude.com/docs/en/cli-reference)、本机安装的 Codex/Gemini `--help`、[OpenCode CLI](https://opencode.ai/docs/cli/)。
