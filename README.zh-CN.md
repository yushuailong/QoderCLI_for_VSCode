# QoderCLI ContextBridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)
[![CI](https://github.com/yushuailong/QoderCLI_ContextBridge/actions/workflows/ci.yml/badge.svg)](https://github.com/yushuailong/QoderCLI_ContextBridge/actions/workflows/ci.yml)

[English](README.md) | **简体中文**

> 为 [Qoder CLI](https://docs.qoder.com) 会话注入 VSCode 实时编辑器上下文（当前文件、光标行号、选区）——每条消息自动附加，全程无感。

> **声明**：本项目为非官方社区扩展，并非由 Qoder 官方团队开发、背书或维护，与官方无隶属关系。

## 为什么

集成终端里的 Qoder CLI 会话看不见你的编辑器。ContextBridge 补上的正是这一块：它在你发出的每条 **Qoder CLI** 消息里自动注入编辑器上下文——自动附上"你正在看什么"，不用敲 `@file`，不用复制粘贴，不用截图。

## 特性

- **四种打开方式** — 状态栏左侧 **"Qoder"** 按钮、快捷键 `Cmd+Alt+Q`（Windows/Linux 为 `Ctrl+Shift+Q`）、终端面板 `+` 下拉中的 **Qoder CLI**、命令面板中的 **"Qoder CLI: Open Terminal"**；再次触发任一方式只会聚焦已有终端，不会重复新建
- **开箱即用** — 安装即用；唯一配置项 `qoder.executablePath`，仅在 `qoder` 不在 `PATH` 时需要设置（默认自动从 `PATH` 查找）
- **零侵入** — 不修改 `~/.qoder/settings.json`，不修改任何项目文件；卸载扩展即完全消失
- **实时拉取** — 上下文在每次发送消息的瞬间从编辑器读取，永远最新
- **未保存标记** — 文件有未保存修改时，注入头部会标注 `(unsaved)`
- **同时列出所有打开文件** — 除活动文件外，注入内容还会列出所有已打开文件，让模型看到你的完整工作集
- **多窗口安全** — 按会话工作目录（cwd）严格匹配所属 VSCode 窗口，多项目并行互不串扰
- **支持 Remote-SSH** — 扩展运行在远程扩展宿主上，远程窗口同样能在当前终端启动 Qoder CLI 并注入上下文

## 前置要求

- VSCode ≥ 1.85
- Qoder CLI（位于 `PATH` 中，或设置 [`qoder.executablePath`](#配置)）
- Node.js ≥ 18

> Remote-SSH 场景：扩展运行在远程服务器上，`qoder` 与 `node` 需安装在**服务器**的 `PATH` 中。

## 安装

1. 从 [Releases](../../releases) 下载最新的 `.vsix`
2. 安装：`code --install-extension <下载的文件路径>`
3. 重启 VSCode（或执行 **Reload Window**）

## 快速开始

1. 打开一个项目文件夹
2. 四种打开方式任选：状态栏左侧的 **"Qoder"** 按钮（一键）、快捷键 `Cmd+Alt+Q`（Windows/Linux 为 `Ctrl+Shift+Q`）、终端面板 `+` 旁下拉选择 **"Qoder CLI"**、或命令面板选择 **"Qoder CLI: Open Terminal"**
3. 选中一段代码，在终端里直接问："我在看哪一行？"——回答应包含文件名与行号

## 远程（SSH）使用

扩展声明为 workspace 类型，在 Remote-SSH 窗口中运行于远程扩展宿主：

1. 在 Remote-SSH 窗口打开扩展面板——本扩展位于"本地 – 已安装"下，带有 **"Install in SSH: \<host\>"** 按钮，点击一次（每台服务器仅需一次）
2. Reload Window 后照常打开 Qoder CLI 终端——它会在当前窗口的远程终端中启动并加载 hook

在 Remote-SSH 窗口内从 Marketplace 安装会自动装到远程，无需额外步骤。若在远程窗口点击 "Qoder CLI" 弹出**新的本地窗口**，说明扩展还运行在本地——先做第 1 步。

## 注入内容示例

每条消息发送时，hook 会把如下块作为 `additionalContext` 附加到提示中（下为真实输出格式，如实展示）：

```text
[Editor context injected by QoderCLI ContextBridge]
Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:
```ts
const a = 1;
```
Open files (3): src/lib/a.ts, src/lib/b.ts (unsaved), package.json
```

- 无选区时 Active 行单行结束、无代码围栏：`Active: src/app.ts — cursor L42`（行号均为 1-based）
- 其余已打开文件列在 Open files 行——排除活动文件，未保存的标注 `(unsaved)`；超过 15 个截断为前 15 个并追加 `… and N more`，没有其他打开文件时整行省略
- 选区超过 2000 字符时截断，并在代码块内追加 `…(selection truncated to 2000 characters)` 注记
- 代码围栏按文件扩展名标注语言（如 `ts`、`python`…），反引号数量比选区内最长的反引号串多一个（至少 3 个），内嵌围栏不会破坏格式

## 工作原理

```
┌─ VSCode 扩展 ─────────────┐        ┌─ qoder CLI 会话 ────────┐
│ 127.0.0.1:/context (只读) │ ◄────  │ UserPromptSubmit hook   │
│ windows.json 窗口注册      │  token │ 按 cwd 匹配本窗口       │
└────────────────────────────┘        └─────────────────────────┘
```

扩展通过启动参数 `qoder --settings <扩展自管理配置>` 仅为该会话注入一个 `UserPromptSubmit` hook（深度合并，不影响你的其他配置）。hook 在你每次发送消息时实时请求扩展获取编辑器状态，并以 `additionalContext` 附加到提示中。hook 超时为 5 秒；单个窗口取数 500ms 超时后自动尝试下一个候选窗口；任何失败都静默降级——消息照常发送，只是没有上下文。

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `qoder.executablePath` | string | 空 | qoder 可执行文件的绝对路径。留空时自动从 `PATH` 查找 qoder；仅当 qoder 不在 PATH 中时才需要设置。 |

## 故障排查

**终端下拉里找不到 "Qoder CLI"**

- 确认点的是 `+` 号旁的下拉箭头（或在命令面板中搜索 "Qoder CLI"）
- 扩展刚安装或更新过时，先执行 **Reload Window**
- 另请检查 `terminal.integrated.defaultProfile.*` 是否被误设为其他值

**会话里没有收到编辑器上下文**

- 确认会话是通过本扩展的四种入口启动的——在普通终端直接运行 `qoder` 不会注入任何内容（这是零侵入设计）
- 在 `<globalStorage>/qoder-settings.json` 中给 hook 命令前加上 `EDITOR_CONTEXT_DEBUG=1` 后重启会话，可在 stderr 看到 hook 报错

**点了别的终端，打开的却是 Qoder CLI**

- 检查 `terminal.integrated.defaultProfile.osx/windows/linux` 是否被设为 "Qoder CLI"，改回 zsh（或系统默认）即可

**Remote-SSH 窗口里点击 "Qoder CLI" 弹出新窗口**

- 扩展运行在了本地而非服务器上。在扩展面板对本扩展点击 **"Install in SSH: \<host\>"**，然后 Reload Window

**Remote-SSH 窗口的终端下拉里没有 "Qoder CLI"**

- 扩展尚未安装到远程主机——同样先在扩展面板点击 **"Install in SSH: \<host\>"**

## 已知限制

- 若你自己配置过 `UserPromptSubmit` hook，在扩展启动的会话中会被本扩展的配置覆盖（其他事件类型不受影响）
- 上下文在发送消息的瞬间快照；会话中途切换编辑器后，需下一条消息才会反映新状态
- 每个窗口同时只有一个 "Qoder CLI" 终端（再次点击会聚焦已有终端而非新建）
- 窗口异常退出可能在注册表留下失效条目：无害（hook 自动跳过），卸载扩展即清除
- 多窗口同时启动时理论上存在注册表并发写丢失更新（窗口重新获得焦点或 Reload 时自愈）
- 本地 HTTP 服务仅绑定 127.0.0.1 并要求随机 token（尽力而为级防护，与同类方案一致）
- 每台 Remote-SSH 服务器需一次性 **"Install in SSH: \<host\>"**，之后扩展才能在远程运行

## Roadmap

- 复用同一端点的 MCP 通道
- 注入字段可配置

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build       # dist/extension.js + dist/hook.mjs
npm run package     # 产出 .vsix
```

测试基于 node:test，需要 Node ≥ 24。本地调试：F5 启动扩展开发宿主（需先 `npm run build`；改代码后重新 build 再 Reload）。

## License

MIT
