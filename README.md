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
| `qodercli` | Qoder CLI installed on your `PATH` (as `qodercli` or the `qoder` dispatcher) or at a default install location; or set `qoder.executablePath` |
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
   hook, and launches the terminal as `qoder --settings <that file>` (customizable —
   see [Custom launch arguments](#custom-launch-arguments)).
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
| `qoder.executablePath` | string | `""` | Absolute path to the CLI executable. When empty, `qodercli` is looked up on `PATH` first, then the `qoder` dispatcher, then default install locations (`~/.local/bin/qodercli`, `~/.qoder/bin/qodercli/qodercli`, `~/.qoder/entry/qoder`) — no configuration needed for a standard install. |
| `qoder.injectEditorContext` | boolean | `true` | Pass `--settings <deployed settings file>` automatically so editor context is injected. Turn it off if your CLI build rejects `--settings`, or if you load your own settings file via `qoder.launchArgs`. |
| `qoder.launchArgs` | string[] | `[]` | Extra arguments appended to the launch command, after the automatically injected ones. Supports `${settingsPath}` and `${hookPath}` variables. |

## Custom launch arguments

By default the terminal is launched as `qoder --settings <deployed qoder-settings.json>`.
If that does not fit your setup — you want your own settings file, extra flags, or a CLI
build that does not accept `--settings` — you can take control with `qoder.launchArgs`:

```jsonc
// user or workspace settings.json
{
  // start bare, without the injected --settings
  "qoder.injectEditorContext": false,
  // ...then compose the command line yourself
  "qoder.launchArgs": [
    "--settings", "/home/me/.qoder/my-settings.json",
    "--verbose"
  ]
}
```

- Arguments from `qoder.launchArgs` come **after** the automatically injected ones. Many
  CLIs take the last occurrence of a repeated flag, so a `--settings` you add there
  usually wins — but if your CLI build rejects duplicate flags, set
  `qoder.injectEditorContext` to `false` to skip the injected file entirely.
- The variables `${settingsPath}` (the deployed settings file) and `${hookPath}` (the
  deployed hook script) are expanded in each argument. Example:
  `"qoder.launchArgs": ["--settings", "${settingsPath}"]`.
- Settings are read at every launch — no window reload needed.

### Merging the hook into your own settings

If you use your own `--settings` file, copy the hook registration into it so editor
context keeps working. Run **Qoder CLI: Open Editor Context Settings File** from the
Command Palette to open the deployed `qoder-settings.json`, then merge its
`hooks.UserPromptSubmit` entry (which invokes `node "<hookPath>"`) into your file.

## Remote development (Remote-SSH, containers, WSL)

The extension runs on the workspace side, so it works in remote sessions:

- Install it on the remote host once — click **Install in SSH: \<host\>** in the
  Extensions view.
- `qoder` and `node` must be on the *remote* machine's `PATH`.
- `PATH` entries such as `~/.vscode-server/bin/remote-cli/` hold client-forwarding
  shims rather than the real CLI; those are detected and skipped automatically.

## Troubleshooting

**"qodercli/qoder executable not found"** — install Qoder CLI, or set `qoder.executablePath`
to its absolute path. Lookup tries `qodercli` first, then `qoder`, then default install
locations (`~/.local/bin/qodercli`, `~/.qoder/bin/qodercli/qodercli`, `~/.qoder/entry/qoder`),
so a standard install works with no configuration even in windows launched from the Dock;
a `qoder` PATH entry that is actually an IDE launcher (e.g. a stale `/usr/local/bin/qoder`
symlink) is never picked.

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
