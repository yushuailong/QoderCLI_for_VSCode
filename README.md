# QoderCLI for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)

**English** | [简体中文](README.zh-CN.md)

> Chat with **Qoder CLI** in the VS Code integrated terminal — every message automatically carries your live editor context: active file, cursor line, selection, and open files. No `@file` typing, no copy-paste.

> **Disclaimer:** This is an unofficial community extension, not affiliated with the Qoder team.

## What it does

Select some code, then ask in the terminal *"what does this line do?"* — the agent already sees your file, line numbers, and selection:

```text
[Editor context injected by QoderCLI for VS Code]
Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:
```ts
const a = 1;
```
Open files (3): src/lib/a.ts, src/lib/b.ts (unsaved), package.json
```

- **Zero-config, zero-touch** — works out of the box; never modifies `~/.qoder/settings.json` or project files
- **Always current** — context is read from the editor at the instant each message is sent
- **Multiple terminals** — each launch opens a new, auto-numbered Qoder CLI terminal, focused automatically
- **Remote-SSH ready** — works in remote terminals (needs `qoder` and `node` on the server's PATH; click **Install in SSH: \<host\>** once per server)

## Install

1. Download the latest `.vsix` from [Releases](../../releases)
2. Install it: `code --install-extension <file>`
3. Reload VS Code (requires VS Code ≥ 1.85 and Qoder CLI on `PATH`)

## Use

1. Open a project folder
2. Open a Qoder CLI terminal — any of: status bar **Qoder** button, `Cmd+Alt+Q` (`Ctrl+Shift+Q` on Windows/Linux), terminal `+` dropdown → **Qoder CLI**, or Command Palette → **Qoder CLI: Open Terminal**
3. Select code in the editor and just ask

## License

MIT
