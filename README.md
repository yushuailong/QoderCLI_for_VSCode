# QoderCLI for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com)

**English** | [简体中文](README.zh-CN.md)

Run the **Qoder CLI** coding agent in a VS Code terminal, and have it automatically
see what you are looking at in the editor — the active file, the cursor line, the
selected code, and the other files you have open.

> **Unofficial community extension.** Not affiliated with or endorsed by the Qoder team.

## The problem it solves

Qoder CLI is a terminal agent, so it has no idea what your editor is doing. Normally
you end up describing your position by hand on every single message:

```text
> in src/auth/session.ts, around line 42, the block I have selected — why does it throw?
```

With this extension you just select the code and ask:

```text
> why does this throw?
```

The file path, line numbers, and the selected source are attached to the message for
you, automatically, every time.

## Requirements

| Requirement | Details |
| --- | --- |
| VS Code | 1.85 or newer |
| `qoder` | Qoder CLI installed and on your `PATH`, or set `qoder.executablePath` |
| `node` | On your `PATH` — used to run the context hook |
| Workspace | A folder must be open; context is matched per workspace folder |

## Install

1. Download the latest `.vsix` from [Releases](../../releases).
2. Install it:
   ```bash
   code --install-extension qodercli-for-vscode-<version>.vsix
   ```
3. Reload VS Code.

## Quick start

1. Open your project folder.
2. Open a Qoder CLI terminal — pick whichever you like:
   - the **Qoder** button in the status bar
   - <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>Q</kbd> (macOS) / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd> (Windows, Linux)
   - the terminal panel `+` dropdown → **Qoder CLI**
   - Command Palette → **Qoder CLI: Open Terminal**
3. Select some code in the editor, then type your question in that terminal.

Each launch opens a new, auto-numbered terminal (`Qoder CLI`, `Qoder CLI 2`, …) and
focuses it, so you can keep several agent sessions side by side.

## What gets attached to your message

Every prompt you submit is prefixed with a block like this:

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

Details:

- **Active file** — path relative to the workspace, plus `(unsaved)` when the buffer is dirty.
- **Cursor line** — 1-based, so it matches what the editor shows you.
- **Selection** — line range and the source itself, fenced and language-tagged. Long
  selections are truncated at 2,000 characters with a note.
- **Open files** — up to 15 other open editors, each marked `(unsaved)` when dirty.

The context is read from the editor *at the moment you press Enter*, so it is never
stale — move the cursor and the next message follows it.

## How it works

```text
you press Enter in the Qoder CLI terminal
   │
   ▼
qoder runs its UserPromptSubmit hook  (node hook.mjs)
   │
   ▼
the hook matches the terminal's cwd to a VS Code window  (windows.json)
   │
   ▼   GET http://127.0.0.1:<port>/context   + X-Editor-Token
the extension replies with the live editor context
   │
   ▼
that context is prepended to your prompt
```

1. On activation the extension starts a tiny HTTP server bound to `127.0.0.1` on a
   random port, guarded by a per-window random token, exposing one read-only route:
   `GET /context`.
2. It records that window — port, token, workspace folders — in a registry file inside
   the extension's own global storage.
3. It writes its own `qoder-settings.json` there too, registering a `UserPromptSubmit`
   hook, and launches the terminal as `qoder --settings <that file>`.
4. When you submit a prompt, Qoder CLI runs the hook. The hook looks up which VS Code
   window owns the terminal's working directory, fetches the live context over
   localhost, and returns it as additional context for that message.

Two consequences worth knowing:

- **Nothing of yours is modified.** Your `~/.qoder/settings.json`, your project files,
  and your workspace settings are left completely alone — the hook config lives only in
  the extension's private storage and is passed explicitly with `--settings`.
- **Failures are silent and harmless.** If the window can't be found or the request
  times out, your prompt is sent through unchanged rather than blocked.

## Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `qoder.executablePath` | string | `""` | Absolute path to the `qoder` executable. When empty, `qoder` is looked up on `PATH`. |

## Remote development (Remote-SSH, containers, WSL)

The extension runs on the workspace side, so it works in remote sessions:

- Install it on the remote host once — click **Install in SSH: \<host\>** in the
  Extensions view.
- `qoder` and `node` must be on the *remote* machine's `PATH`.
- `PATH` entries such as `~/.vscode-server/bin/remote-cli/` hold client-forwarding
  shims rather than the real CLI; those are detected and skipped automatically.

## Troubleshooting

**"qoder executable not found"** — install Qoder CLI, or set `qoder.executablePath`
to its absolute path. Remember that VS Code inherits the `PATH` it was launched with;
after editing your shell profile, restart VS Code.

**No context block appears in the agent's view** — check that:

- a file is focused in the editor (a real file on disk — the settings UI, output
  panel, and diff-only views are skipped),
- the terminal's working directory is inside an open workspace folder,
- `node` is on your `PATH`.

To see why the hook stayed quiet, start the terminal with `EDITOR_CONTEXT_DEBUG=1` set
in the environment; the hook then writes diagnostics to stderr.

## Build from source

```bash
npm install
npm run build       # bundle the extension and the hook into dist/
npm run typecheck
npm test
npm run package     # produce a .vsix
```

## License

MIT — see [LICENSE](LICENSE).
