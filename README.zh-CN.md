# QoderCLI for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)

[English](README.md) | **简体中文**

> 在 VS Code 集成终端里使用 **Qoder CLI** —— 你发出的每条消息都自动带上实时编辑器上下文：当前文件、光标行、选区、已打开文件。不用敲 `@file`，不用复制粘贴。

> **声明**：本项目为非官方社区扩展，与 Qoder 官方无隶属关系。

## 它能做什么

选中一段代码，在终端里直接问 *"这行是干什么的？"* —— 模型已经能看到你的文件、行号和选区：

```text
[Editor context injected by QoderCLI for VS Code]
Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:
```ts
const a = 1;
```
Open files (3): src/lib/a.ts, src/lib/b.ts (unsaved), package.json
```

- **开箱即用、零侵入** — 不修改 `~/.qoder/settings.json` 和任何项目文件
- **永远最新** — 上下文在每次发送消息的瞬间从编辑器读取
- **多终端** — 每次启动都新开一个自动编号的 Qoder CLI 终端，并自动聚焦
- **支持 Remote-SSH** — 远程终端同样可用（`qoder`、`node` 需在服务器 PATH 上；每台服务器点一次 **"Install in SSH: \<host\>"**）

## 安装

1. 从 [Releases](../../releases) 下载最新的 `.vsix`
2. 安装：`code --install-extension <文件路径>`
3. 重启 VS Code（要求 VS Code ≥ 1.85，Qoder CLI 在 `PATH` 上）

## 使用

1. 打开一个项目文件夹
2. 打开 Qoder CLI 终端 — 任选其一：状态栏 **Qoder** 按钮、`Cmd+Alt+Q`（Windows/Linux 为 `Ctrl+Shift+Q`）、终端 `+` 下拉选 **Qoder CLI**、或命令面板选 **"Qoder CLI: Open Terminal"**
3. 在编辑器里选中代码，直接提问

## License

MIT
