# 发布到 Obsidian 社区目录

源码仓库：https://github.com/GameSheep/ZAgent

GitHub Releases：https://github.com/GameSheep/ZAgent/releases

## 当前状态

- 发布版本：`0.1.0`；版本 tag 必须为 `0.1.0`，与根目录 `manifest.json` 完全一致。
- Release 附件：`main.js`、`manifest.json`、`styles.css`，以及方便手动安装的 `zagent-0.1.0.zip`。
- 社区目录：尚未提交审核，尚不能在 Obsidian 内搜索安装。
- Windows 的参数传递与真实交互终端已验证；真实 Obsidian 宿主的完整验收与 macOS/Linux 终端实测仍待完成。

## 提交步骤

1. 使用插件维护者的 Obsidian 账号登录 [Obsidian Community](https://community.obsidian.md)。
2. 在个人资料中连接拥有 `GameSheep/ZAgent` 仓库的 GitHub 账号。
3. 进入 **Plugins → New plugin**，填写 `https://github.com/GameSheep/ZAgent` 并选择归属者。
4. 由维护者本人阅读并接受开发者政策，确认维护责任，再提交。
5. 查看自动审核结果。根据错误修改源码，增加版本号并发布新 Release；所有阻断错误解决并发布目录条目后，用户才能从 Obsidian 内搜索安装。

不能仅上传 zip，也不能用 GitHub Release 代替社区目录提交。默认分支根目录必须有准确的 `manifest.json`、README 和许可证，Release 必须上传三个独立插件文件。

## 本地验证与后续版本

```sh
npm ci
npm test
npm run build
npm run package
```

Windows 可额外运行 `npm run test:terminal`，它会打开测试专用终端并正常退出，不调用模型。

更新版本时同步修改 `package.json`、`manifest.json` 与 `versions.json`，保留历史最低兼容版本记录。先验证源码，再创建与 manifest 一致的 tag 和 Release。

用户已有的 Agent 登录、权限和服务配置由 Agent 自行管理；ZAgent 不提供模型服务，不内置 API 密钥。

官方参考：[提交插件](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)、[账号连接与提交表单](https://docs.obsidian.md/community-directory/set-up-and-claim)。
