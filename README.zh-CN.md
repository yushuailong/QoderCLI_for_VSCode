# QoderCLI for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)

[English](README.md) | **简体中文**

在 VS Code 终端里运行 **Qoder CLI** 编程智能体，并让它自动"看见"你编辑器里的状态——
当前文件、光标所在行、选中的代码，以及你打开的其他文件。

> **非官方社区扩展**，与 Qoder 官方团队无隶属关系，也未获其背书。

## 它解决什么问题

Qoder CLI 是终端里的智能体，本身并不知道你的编辑器在做什么。于是每条消息你都得手动
交代自己的位置：

```text
> src/auth/session.ts 第 42 行附近，我选中的那段，为什么会抛异常？
```

装上这个扩展后，选中代码直接问：

```text
> 这里为什么会抛异常？
```

文件路径、行号、选中的源码，每一次都会自动附加到你的消息上。

## 环境要求

| 项目 | 说明 |
| --- | --- |
| VS Code | 1.85 及以上 |
| `qoder` | 已安装 Qoder CLI 且在 `PATH` 上，或配置 `qoder.executablePath` |
| `node` | 在 `PATH` 上——用于运行上下文 hook |
| 工作区 | 需要打开一个文件夹；上下文按工作区文件夹匹配 |

## 安装

1. 从 [Releases](../../releases) 下载最新的 `.vsix`。
2. 安装：
   ```bash
   code --install-extension qodercli-for-vscode-<版本号>.vsix
   ```
3. 重新加载 VS Code。

## 快速开始

1. 打开你的项目文件夹。
2. 打开一个 Qoder CLI 终端，任选一种方式：
   - 状态栏的 **Qoder** 按钮
   - <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>Q</kbd>（macOS）/ <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>（Windows、Linux）
   - 终端面板 `+` 下拉菜单 → **Qoder CLI**
   - 命令面板 → **Qoder CLI: Open Terminal**
3. 在编辑器里选中代码，然后在该终端提问。

每次启动都会新开一个自动编号的终端（`Qoder CLI`、`Qoder CLI 2`……）并自动聚焦，方便
你并行开多个会话。

## 消息里会附加什么

你提交的每条 prompt 前面都会加上这样一段：

````text
[Editor context injected by QoderCLI for VS Code]
Active: src/auth/session.ts (unsaved) — cursor L42, selection L40-L45:
```ts
if (!token) {
  throw new AuthError("missing token");
}
```
Open files (3): src/auth/index.ts, src/lib/http.ts (unsaved), package.json
````

说明：

- **当前文件**——相对工作区的路径，缓冲区未保存时带 `(unsaved)`。
- **光标行**——从 1 开始计数，与编辑器显示一致。
- **选区**——行范围加源码本身，带代码围栏和语言标记。超长选区会截断到 2000 字符并给出提示。
- **打开的文件**——最多 15 个其他打开的编辑器，未保存的标注 `(unsaved)`。

上下文是在你**按下回车的那一刻**从编辑器读取的，所以永远不会过时——移动光标，下一条
消息就跟着变。

## 工作原理

```text
你在 Qoder CLI 终端按下回车
   │
   ▼
qoder 执行 UserPromptSubmit hook（node hook.mjs）
   │
   ▼
hook 用终端的工作目录匹配到对应的 VS Code 窗口（windows.json）
   │
   ▼   GET http://127.0.0.1:<端口>/context   + X-Editor-Token
扩展返回实时的编辑器上下文
   │
   ▼
这段上下文被拼接到你的 prompt 前面
```

1. 扩展激活时，在 `127.0.0.1` 的随机端口上启动一个极小的 HTTP 服务，用每窗口独立的
   随机 token 校验，只暴露一个只读路由 `GET /context`。
2. 把该窗口的端口、token、工作区文件夹登记到扩展自己全局存储目录下的注册表文件里。
3. 同时在那里写一份自己的 `qoder-settings.json`，注册 `UserPromptSubmit` hook，并以
   `qoder --settings <该文件>` 启动终端。
4. 你提交 prompt 时，Qoder CLI 会执行 hook。hook 根据终端的工作目录找到对应的 VS Code
   窗口，通过本机回环取到实时上下文，作为这条消息的附加上下文返回。

两个值得知道的结果：

- **不改动你的任何配置**。`~/.qoder/settings.json`、项目文件、工作区设置都完全不碰——
  hook 配置只存在扩展的私有存储目录里，通过 `--settings` 显式传入。
- **失败是静默且无害的**。找不到窗口或请求超时时，你的 prompt 会原样发出，而不是被卡住。

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `qoder.executablePath` | string | `""` | `qoder` 可执行文件的绝对路径。留空时从 `PATH` 自动查找。 |

## 远程开发（Remote-SSH、容器、WSL）

扩展运行在工作区一侧，因此远程场景同样可用：

- 在远程主机上安装一次——在扩展视图点击 **Install in SSH: \<host\>**。
- `qoder` 和 `node` 需要在**远程**机器的 `PATH` 上。
- 像 `~/.vscode-server/bin/remote-cli/` 这类 `PATH` 目录里放的是转发回客户端的 shim
  而非真正的 CLI，扩展会自动识别并跳过。

## 排查问题

**提示 "qoder executable not found"**——安装 Qoder CLI，或把 `qoder.executablePath`
设为它的绝对路径。注意 VS Code 继承的是启动时的 `PATH`，改完 shell 配置需要重启 VS Code。

**智能体那边看不到上下文块**——检查：

- 编辑器里是否聚焦着一个文件（必须是磁盘上的真实文件——设置界面、输出面板、纯 diff
  视图会被跳过），
- 终端的工作目录是否在已打开的工作区文件夹内，
- `node` 是否在 `PATH` 上。

想知道 hook 为什么没输出，可以在环境里设 `EDITOR_CONTEXT_DEBUG=1` 后再开终端，hook
会把诊断信息写到 stderr。

## 从源码构建

```bash
npm install
npm run build       # 把扩展和 hook 打包到 dist/
npm run typecheck
npm test
npm run package     # 生成 .vsix
```

## License

MIT — 见 [LICENSE](LICENSE)。
