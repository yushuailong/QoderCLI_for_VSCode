# QoderCLI ContextBridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)
[![CI](https://github.com/yushuailong/QoderCLI_ContextBridge/actions/workflows/ci.yml/badge.svg)](https://github.com/yushuailong/QoderCLI_ContextBridge/actions/workflows/ci.yml)

**English** | [简体中文](README.zh-CN.md)

> Bridge real-time VS Code editor context (active file, cursor line, selection) into **Qoder CLI** sessions — silently, on every message.

> **Disclaimer:** This is an unofficial community extension. It is not developed by, endorsed by, or affiliated with the Qoder team.

## Why

Qoder CLI sessions running in the integrated terminal can't see your editor. ContextBridge fixes this: it injects editor context into every **Qoder CLI** message you send — automatically annotated with what you're looking at, no `@file` typing, no copy-paste, no screenshots.

## Features

- **Four ways to open** — status bar **Qoder** button, `Cmd+Alt+Q` (`Ctrl+Shift+Q` on Windows/Linux), terminal `+` dropdown → **Qoder CLI**, or Command Palette → **Qoder CLI: Open Terminal**; each trigger opens a new terminal (auto-numbered: Qoder CLI, Qoder CLI 2, …), and the new terminal is focused automatically
- **Zero-config** — install and go; the only setting is `qoder.executablePath`, needed only when `qoder` is not on `PATH` (auto-discovered there otherwise)
- **Zero-touch** — never modifies `~/.qoder/settings.json` or any project file; uninstall and it's gone
- **Real-time pull** — context is fetched from the editor at the instant each message is sent, so it is always current
- **Unsaved marker** — when the file has unsaved changes, the injected header is annotated `(unsaved)`
- **Open files listed** — All open files are listed alongside the active one, so the agent sees your whole working set
- **Multi-window safe** — sessions are strictly matched to the VS Code window whose workspace contains the session's cwd, so parallel projects never cross-talk
- **Remote-SSH supported** — the extension runs on the remote extension host, so remote windows launch Qoder CLI in the current terminal with context injection working

## Requirements

- VS Code ≥ 1.85
- Qoder CLI (available on `PATH`, or set [`qoder.executablePath`](#configuration))
- Node.js ≥ 18

> Remote-SSH: the extension runs on the remote server, so `qoder` and `node` must be available on the **server's** `PATH`.

## Installation

1. Download the latest `.vsix` from [Releases](../../releases)
2. Install it: `code --install-extension <path-to-the-downloaded-file>`
3. Restart VS Code (or run **Developer: Reload Window**)

## Quick Start

1. Open a project folder
2. Open a Qoder CLI terminal — any of the four ways: status bar **Qoder** button, `Cmd+Alt+Q` (`Ctrl+Shift+Q` on Windows/Linux), terminal `+` dropdown → **Qoder CLI**, or Command Palette → **Qoder CLI: Open Terminal**
3. Select some code in the editor and ask in the terminal *"which line am I looking at?"* — the answer includes your file and line numbers

## Remote (SSH) usage

The extension is declared workspace-kind, so in Remote-SSH windows it runs on the remote extension host:

1. Open the Extensions view in your Remote-SSH window — the extension sits under "Local – Installed" with an **Install in SSH: \<host\>** button. Click it (once per server).
2. Reload Window, then open the Qoder CLI terminal as usual — it starts in the remote terminal of the current window, hook loaded.

Installing from the Marketplace while inside a Remote-SSH window installs to the remote automatically. If clicking "Qoder CLI" in a remote window opens a **new local window**, the extension is still running on the local side — do step 1 first.

## What gets injected

On every message, the hook appends a block like this as `additionalContext` (reproduced exactly as produced):

```text
[Editor context injected by QoderCLI ContextBridge]
Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:
```ts
const a = 1;
```
Open files (3): src/lib/a.ts, src/lib/b.ts (unsaved), package.json
```

Decoded: the first line attributes the context to this extension; `Active:` is the current file plus an `(unsaved)` marker when dirty, `cursor L42` is the cursor line, and `selection L40-L45` is the selected line range.

- With no selection, the Active line ends without a code fence: `Active: src/app.ts — cursor L42` (line numbers are 1-based)
- All other open files are listed on the Open files line — the active file excluded, dirty files marked `(unsaved)`; more than 15 entries are truncated with an `… and N more` note, and the line is omitted entirely when there are no other open files
- Selections longer than 2000 characters are truncated, with a trailing `…(selection truncated to 2000 characters)` note inside the block
- The code fence is language-tagged from the file extension (`ts`, `python`, …) and uses one more backtick than the longest backtick run in the selection (at least 3), so embedded fences never break the block

## How it works

```
┌─ VS Code extension ────────┐        ┌─ qoder CLI session ─────┐
│ 127.0.0.1:/context (RO)    │ ◄────  │ UserPromptSubmit hook   │
│ windows.json registration  │  token │ match window by cwd     │
└────────────────────────────┘        └─────────────────────────┘
```

The extension starts a read-only HTTP endpoint on `127.0.0.1` and registers the window (workspace folders + port + random token) in its own storage. It launches qoder with `--settings <extension-managed file>` — a deep-merged, session-scoped config that adds a single `UserPromptSubmit` hook. On every message, the hook matches the session's cwd to the right window, fetches live editor state, and appends it as `additionalContext`. The hook runs with a 5 s timeout; each per-window fetch gives up after 2 s and falls through to the next candidate window, and any failure degrades silently — your message is still sent, just without context.

## Configuration

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `qoder.executablePath` | string | `""` | Absolute path to the `qoder` executable. When left empty, `qoder` is looked up automatically from `PATH`. Only needs to be set when `qoder` is not on `PATH`. |

## Troubleshooting

**"Qoder CLI" is missing from the terminal dropdown**

- Make sure you clicked the dropdown arrow next to the `+` button (or search "Qoder CLI" in the Command Palette)
- If the extension was just installed or updated, run **Developer: Reload Window** first
- Also check that `terminal.integrated.defaultProfile.*` hasn't been set to an unexpected value

**The session receives no editor context**

- Make sure the session was started through one of this extension's four entry points — running `qoder` directly in a normal terminal injects nothing (that's the zero-touch design)
- To surface hook errors, add `EDITOR_CONTEXT_DEBUG=1` in front of the hook command in `<globalStorage>/qoder-settings.json` and restart the session; errors are then printed to stderr

**Clicking another terminal opens Qoder CLI instead**

- Check whether `terminal.integrated.defaultProfile.osx/windows/linux` is set to "Qoder CLI" — change it back to `zsh` or the default profile

**In a Remote-SSH window, clicking "Qoder CLI" opens a new window**

- The extension is running on your local machine instead of the server. Click **Install in SSH: \<host\>** on this extension in the Extensions view, then Reload Window

**"Qoder CLI" is missing from the terminal dropdown in a Remote-SSH window**

- The extension hasn't been installed on the remote host yet — same fix: click **Install in SSH: \<host\>** in the Extensions view

## Known limitations

- If you have configured your own `UserPromptSubmit` hook, it is overridden in sessions launched by this extension (other event types are unaffected)
- Context is snapshotted at the moment a message is sent; if you switch editors mid-session, the next message is the first to reflect the new state
- Abnormal window exits may leave stale entries in the registry: harmless (the hook skips them automatically), cleared on uninstall
- When multiple windows start at the same time, a concurrent-write lost update in the registry is theoretically possible (self-heals when the window regains focus or after a reload)
- The local HTTP server binds only to 127.0.0.1 and requires a random token (best-effort protection, on par with similar solutions)
- Each Remote-SSH server needs a one-time **Install in SSH: \<host\>** before the extension runs there

## Roadmap

- MCP channel reusing the same endpoint
- Configurable injected fields

## Development

```bash
npm install
npm test
npm run typecheck
npm run build       # dist/extension.js + dist/hook.mjs
npm run package     # produces the .vsix
```

Tests are based on `node:test` and require Node ≥ 24. To debug locally, press F5 to launch the Extension Development Host (run `npm run build` first; rebuild and Reload after changing code).

## License

MIT
