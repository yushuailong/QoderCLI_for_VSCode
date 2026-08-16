# QoderCLI ContextBridge（原名 vscode-editor-context）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个零侵入的 VSCode 扩展：通过终端 profile 启动 Qoder CLI 并用 `--settings` 注入 UserPromptSubmit hook，在用户每次发消息时实时拉取并注入编辑器上下文（当前文件、行号、选中文本、保存状态）。

**Architecture:** 拉取式。扩展在 127.0.0.1 随机端口起只读 HTTP 服务并注册窗口信息到 globalStorage 的 windows.json；hook（由 `--settings` 指定的扩展自管理配置激活）在提交提示瞬间按 cwd 匹配窗口、请求扩展拿实时编辑器状态、以 `hookSpecificOutput.additionalContext` 注入。用户全局配置零改动。

**Tech Stack:** TypeScript + VSCode Extension API（engines ^1.85）、esbuild（双入口打包 extension.js / hook.mjs）、node:test（Node ≥24 原生 TS type-stripping 跑测试，零测试框架依赖）、@vscode/vsce 打包。

**对应设计文档:** `docs/superpowers/specs/2026-08-15-vscode-editor-context-design.md`

**关键约定（全计划有效）:**
- 仓库根：`/Users/yushuailong/workspace/vscode-editor-context`
- 所有 TS 互相 import 必须带 `.ts` 扩展名（Node type-stripping 与 esbuild 均支持，tsconfig 已开 allowImportingTsExtensions）
- TS 语法必须可擦除（tsconfig `erasableSyntaxOnly`：禁止 enum/namespace/参数属性）
- 测试命令 `npm test`（即 `node --test "test/**/*.test.ts"`）要求 Node ≥24（本机 v26.4.0 满足）
- 每个 Task 结束都要 commit；commit 信息用中文、 conventional 前缀

变更记录：
- 2026-08-16: 注入格式升级（英文文案/归属行/openFiles），见 design §4.4-4.5；openFiles 构造抽取为 lib 纯函数并按 URI 去重

---

### Task 1: 工程脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `LICENSE`
- Create: `README.md`（先占位一行，Task 9 扩写）
- Create: `src/extension.ts`（空 stub，Task 7 替换）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "vscode-editor-context",
  "displayName": "Qoder CLI Editor Context",
  "description": "Inject real-time VSCode editor context (active file, selection) into Qoder CLI sessions. Zero-config, zero-touch.",
  "version": "0.1.0",
  "publisher": "yushuailong",
  "license": "MIT",
  "engines": {
    "vscode": "^1.85.0"
  },
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "terminal": {
      "profiles": [
        {
          "id": "qoder-cli",
          "title": "Qoder CLI",
          "icon": "terminal"
        }
      ]
    },
    "commands": [
      {
        "command": "qoder-cli.openTerminal",
        "title": "Qoder CLI: 打开终端"
      }
    ],
    "keybindings": [
      {
        "command": "qoder-cli.openTerminal",
        "key": "ctrl+shift+q",
        "mac": "cmd+alt+q"
      }
    ],
    "configuration": {
      "title": "Qoder CLI Editor Context",
      "properties": {
        "qoder.executablePath": {
          "type": "string",
          "default": "",
          "markdownDescription": "qoder 可执行文件的绝对路径。留空时自动从 `PATH` 查找。"
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.js",
    "typecheck": "tsc --noEmit",
    "test": "node --test \"test/**/*.test.ts\"",
    "package": "vsce package --allow-missing-repository"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/vscode": "1.85.0",
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.25.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: 写 .gitignore / .vscodeignore / LICENSE / README / 空 extension stub**

`.gitignore`：

```
node_modules/
dist/
*.vsix
.DS_Store
```

`.vscodeignore`：

```
.vscode/**
src/**
test/**
node_modules/**
docs/**
.github/**
dist/*.map
esbuild.js
tsconfig.json
.gitignore
```

`LICENSE`：

```
MIT License

Copyright (c) 2026 yushuailong

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`README.md`（占位，Task 9 扩写）：

```markdown
# vscode-editor-context

为 Qoder CLI 注入 VSCode 实时编辑器上下文的扩展。（文档完善中）
```

`src/extension.ts`（空 stub）：

```ts
import * as vscode from "vscode";

export function activate(_context: vscode.ExtensionContext): void {}

export function deactivate(): void {}
```

- [ ] **Step 4: 安装依赖并验证 typecheck**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && npm install && npm run typecheck`
Expected: npm 输出 `added N packages`（无 error），typecheck 无输出、退出码 0

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: 工程脚手架（manifest/tsconfig/license/忽略配置）"
```

---

### Task 2: lib/windowRegistry —— 窗口注册表（TDD）

**Files:**
- Test: `test/windowRegistry.test.ts`
- Create: `src/lib/windowRegistry.ts`

职责：windows.json 的容错读写（原子写）、按 windowId upsert/remove、按 cwd 匹配窗口（含 Windows 路径分隔符归一化）。纯 Node 模块，不 import vscode。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  findWindowForCwd,
  loadRegistry,
  removeWindow,
  saveRegistry,
  upsertWindow,
  type WindowEntry,
} from "../src/lib/windowRegistry.ts";

function mkEntry(overrides: Partial<WindowEntry> = {}): WindowEntry {
  return {
    windowId: "w1",
    port: 50001,
    token: "t1",
    workspaceFolders: ["/Users/x/projA"],
    startedAt: 1755230000,
    ...overrides,
  };
}

test("findWindowForCwd: cwd 等于工作区目录时命中", () => {
  const registry = { windows: [mkEntry()] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projA")?.windowId, "w1");
});

test("findWindowForCwd: cwd 位于工作区目录之下时命中", () => {
  const registry = { windows: [mkEntry()] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projA/src/lib")?.windowId, "w1");
});

test("findWindowForCwd: 多根工作区任一 folder 命中即可", () => {
  const registry = {
    windows: [mkEntry({ workspaceFolders: ["/Users/x/projA", "/Users/x/projB"] })],
  };
  assert.equal(findWindowForCwd(registry, "/Users/x/projB/pkg")?.windowId, "w1");
});

test("findWindowForCwd: 无任何命中返回 undefined", () => {
  const registry = { windows: [mkEntry()] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projC"), undefined);
});

test("findWindowForCwd: 前缀相同但目录不同时不误命中", () => {
  const registry = { windows: [mkEntry()] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projABC"), undefined);
});

test("findWindowForCwd: Windows 反斜杠路径归一化后命中", () => {
  const registry = { windows: [mkEntry({ workspaceFolders: ["C:\\work\\projA"] })] };
  assert.equal(findWindowForCwd(registry, "C:\\work\\projA\\src")?.windowId, "w1");
});

test("upsertWindow: 同 windowId 替换，其余保留", () => {
  const registry = { windows: [mkEntry(), mkEntry({ windowId: "w2", port: 50002 })] };
  const updated = upsertWindow(registry, mkEntry({ port: 50009 }));
  assert.deepEqual(
    updated.windows.map((w) => `${w.windowId}:${w.port}`).sort(),
    ["w1:50009", "w2:50002"]
  );
});

test("removeWindow: 仅移除指定 windowId", () => {
  const registry = { windows: [mkEntry(), mkEntry({ windowId: "w2" })] };
  const updated = removeWindow(registry, "w1");
  assert.deepEqual(updated.windows.map((w) => w.windowId), ["w2"]);
});

test("saveRegistry/loadRegistry: 往返一致", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reg-"));
  try {
    const file = join(dir, "windows.json");
    const registry = { windows: [mkEntry()] };
    await saveRegistry(file, registry);
    assert.deepEqual(await loadRegistry(file), registry);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadRegistry: 文件不存在返回空注册表", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reg-"));
  try {
    assert.deepEqual(await loadRegistry(join(dir, "missing.json")), { windows: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadRegistry: 损坏 JSON 返回空注册表", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reg-"));
  try {
    const file = join(dir, "windows.json");
    await writeFile(file, "{not-json", "utf8");
    assert.deepEqual(await loadRegistry(file), { windows: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadRegistry: 结构非法（windows 不是数组）返回空注册表", async () => {
  const dir = await mkdtemp(join(tmpdir(), "reg-"));
  try {
    const file = join(dir, "windows.json");
    await writeFile(file, JSON.stringify({ windows: "nope" }), "utf8");
    assert.deepEqual(await loadRegistry(file), { windows: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && npm test`
Expected: FAIL，报错 `Cannot find module '.../src/lib/windowRegistry.ts'`

- [ ] **Step 3: 实现 windowRegistry.ts**

```ts
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export interface WindowEntry {
  windowId: string;
  port: number;
  token: string;
  workspaceFolders: string[];
  startedAt: number;
}

export interface Registry {
  windows: WindowEntry[];
}

export async function loadRegistry(filePath: string): Promise<Registry> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isRegistry(parsed)) return parsed;
    // 容错读：任何读取/解析失败都按空注册表处理（设计约定：hook 侧静默降级）
  } catch {}
  return { windows: [] };
}

export async function saveRegistry(filePath: string, registry: Registry): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  const tmp = join(dirname(filePath), `.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2));
  await fs.rename(tmp, filePath);
}

export function upsertWindow(registry: Registry, entry: WindowEntry): Registry {
  return {
    windows: [...registry.windows.filter((w) => w.windowId !== entry.windowId), entry],
  };
}

export function removeWindow(registry: Registry, windowId: string): Registry {
  return { windows: registry.windows.filter((w) => w.windowId !== windowId) };
}

export function findWindowsForCwd(registry: Registry, cwd: string): WindowEntry[] {
  return registry.windows
    .filter((w) => w.workspaceFolders.some((folder) => isCwdInside(cwd, folder)))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function findWindowForCwd(registry: Registry, cwd: string): WindowEntry | undefined {
  return findWindowsForCwd(registry, cwd)[0];
}

function isCwdInside(cwd: string, folder: string): boolean {
  const c = toPosix(cwd);
  const f = toPosix(folder);
  if (isWindowsStyle(c) || isWindowsStyle(f)) {
    const lc = c.toLowerCase();
    const lf = f.toLowerCase();
    return lc === lf || lc.startsWith(lf.endsWith("/") ? lf : lf + "/");
  }
  return c === f || c.startsWith(f.endsWith("/") ? f : f + "/");
}

function isWindowsStyle(p: string): boolean {
  return /^[A-Za-z]:/.test(p) || p.startsWith("//");
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function isRegistry(value: unknown): value is Registry {
  if (typeof value !== "object" || value === null) return false;
  const windows = (value as { windows?: unknown }).windows;
  return Array.isArray(windows) && windows.every(isWindowEntry);
}

function isWindowEntry(value: unknown): value is WindowEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.windowId === "string" &&
    typeof e.port === "number" &&
    typeof e.token === "string" &&
    Array.isArray(e.workspaceFolders) &&
    e.workspaceFolders.every((f) => typeof f === "string") &&
    typeof e.startedAt === "number"
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全部 PASS（windowRegistry 相关 11 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/lib/windowRegistry.ts test/windowRegistry.test.ts
git commit -m "feat: 窗口注册表（容错读写/原子写/cwd 匹配）"
```

---

### Task 3: lib/formatContext —— 上下文格式化（TDD）

**Files:**
- Test: `test/formatContext.test.ts`
- Create: `src/lib/formatContext.ts`

职责：把 EditorContext 渲染成注入用的 additionalContext 文本（方案 B 格式、2000 字符截断、按扩展名选代码围栏语言）。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatContext, type EditorContext } from "../src/lib/formatContext.ts";

function mkCtx(overrides: Partial<EditorContext> = {}): EditorContext {
  return {
    file: "/Users/x/projA/src/app.ts",
    relativePath: "src/app.ts",
    line: 42,
    selection: null,
    dirty: false,
    ...overrides,
  };
}

test("无选区: 输出单行头部（文件/光标行）", () => {
  const out = formatContext(mkCtx());
  assert.equal(out, "[VSCode 编辑器上下文] src/app.ts 光标 L42");
});

test("dirty 文件: 头部包含未保存标记", () => {
  const out = formatContext(mkCtx({ dirty: true }));
  assert.ok(out.includes("src/app.ts（未保存）"));
});

test("有选区: 包含选区行号、语言围栏与原文", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 40, endLine: 45, text: "const a = 1;" } })
  );
  assert.ok(out.includes("选区 L40-L45"));
  assert.ok(out.includes("```ts\nconst a = 1;\n```"));
});

test("未知扩展名: 围栏为无语言标注", () => {
  const out = formatContext(
    mkCtx({ file: "/Users/x/projA/Makefile", relativePath: "Makefile",
      selection: { startLine: 1, endLine: 2, text: "all:" } })
  );
  assert.ok(out.includes("```\nall:\n```"));
});

test("超长选区: 截断至 2000 字符并标注", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 99, text: "a".repeat(2500) } })
  );
  assert.ok(out.includes("已截断"));
  assert.ok(!out.includes("a".repeat(2001)));
});

test("已知扩展名映射: .py -> python", () => {
  const out = formatContext(
    mkCtx({ file: "/x/main.py", relativePath: "main.py",
      selection: { startLine: 1, endLine: 2, text: "print(1)" } })
  );
  assert.ok(out.includes("```python"));
});

test("选区含三反引号围栏: 外层围栏自动加长不被破坏", () => {
  const inner = "说明\n```ts\nconst a = 1;\n```\n结尾";
  const out = formatContext(
    mkCtx({ file: "/Users/x/projA/README.md", relativePath: "README.md",
      selection: { startLine: 1, endLine: 6, text: inner } })
  );
  assert.ok(out.includes("````markdown\n" + inner + "\n````"));
});

test("选区恰好 2000 字符: 不截断无标注", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 9, text: "a".repeat(2000) } })
  );
  assert.ok(!out.includes("已截断"));
  assert.ok(out.includes("a".repeat(2000)));
});

test("选区 2001 字符: 截断且标注在闭合围栏之后", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 9, text: "a".repeat(2001) } })
  );
  const lines = out.split("\n");
  const closingIdx = lines.findIndex((l, i) => i > 0 && l === "```");
  const noteIdx = lines.findIndex((l) => l.includes("已截断"));
  assert.ok(closingIdx !== -1 && noteIdx > closingIdx);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，报错 `Cannot find module '.../src/lib/formatContext.ts'`

- [ ] **Step 3: 实现 formatContext.ts**

```ts
export interface EditorContext {
  file: string;
  relativePath: string;
  line: number;
  selection: { startLine: number; endLine: number; text: string } | null;
  dirty: boolean;
}

const MAX_SELECTION_CHARS = 2000;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx", ".mjs": "js", ".cjs": "js",
  ".py": "python", ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
  ".rb": "ruby", ".php": "php", ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp",
  ".cc": "cpp", ".cs": "csharp", ".swift": "swift", ".sh": "bash", ".zsh": "bash",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".ini": "ini",
  ".md": "markdown", ".sql": "sql", ".css": "css", ".scss": "scss", ".less": "less",
  ".html": "html", ".xml": "xml", ".vue": "vue", ".svelte": "svelte",
};

export function formatContext(ctx: EditorContext): string {
  const saveState = ctx.dirty ? "（未保存）" : "";
  const head = `[VSCode 编辑器上下文] ${ctx.relativePath}${saveState} 光标 L${ctx.line}`;
  const sel = ctx.selection;
  if (!sel) return head;
  let text = sel.text;
  let note = "";
  if (text.length > MAX_SELECTION_CHARS) {
    text = text.slice(0, MAX_SELECTION_CHARS);
    // 截断可能把代理对（如 emoji）切半：去掉尾部孤立的高代理项
    if ((text.charCodeAt(text.length - 1) & 0xfc00) === 0xd800) {
      text = text.slice(0, -1);
    }
    note = `…（选区过长，已截断至 ${MAX_SELECTION_CHARS} 字符）`;
  }
  const fence = fenceFor(text);
  const lines = [
    `${head}，选区 L${sel.startLine}-L${sel.endLine}：`,
    fence + languageFor(ctx.file),
    text,
    fence,
  ];
  if (note) lines.push(note);
  return lines.join("\n");
}

function fenceFor(text: string): string {
  let longest = 0;
  for (const m of text.matchAll(/`+/g)) {
    longest = Math.max(longest, m[0].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

function languageFor(file: string): string {
  const dot = file.lastIndexOf(".");
  if (dot === -1) return "";
  return LANGUAGE_BY_EXTENSION[file.slice(dot).toLowerCase()] ?? "";
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatContext.ts test/formatContext.test.ts
git commit -m "feat: 编辑器上下文格式化（方案B/截断/语言围栏）"
```

---

### Task 4: lib/resolveQoder —— qoder 可执行文件解析（TDD）

**Files:**
- Test: `test/resolveQoder.test.ts`
- Create: `src/lib/resolveQoder.ts`

职责：优先用用户配置路径（存在且是文件），否则原生逐目录搜索 env.PATH（posix 检查执行位；Windows 按 PATHEXT 展开候选）。（原计划 which/where 子进程方案在注入 env 时子进程自身 ENOENT，已批准改为原生实现）env 可注入便于测试。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveQoderExecutable } from "../src/lib/resolveQoder.ts";

const skipOnWindows = { skip: process.platform === "win32" ? "posix only" : false };

test("configuredPath 指向存在的文件: 直接返回", skipOnWindows, async () => {
  const dir = await mkdtemp(join(tmpdir(), "qoder-"));
  try {
    const file = join(dir, "qoder-bin");
    await writeFile(file, "#!/bin/sh\n", "utf8");
    assert.equal(await resolveQoderExecutable(file), file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("configuredPath 不存在: 返回 undefined", async () => {
  assert.equal(await resolveQoderExecutable("/nonexistent/qoder"), undefined);
});

test("未配置时从 PATH 查找", skipOnWindows, async () => {
  const dir = await mkdtemp(join(tmpdir(), "qoder-"));
  try {
    const bin = join(dir, "qoder");
    await writeFile(bin, "#!/bin/sh\necho hi\n", "utf8");
    await chmod(bin, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: dir,
    });
    assert.equal(found, bin);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PATH 中也没有: 返回 undefined", skipOnWindows, async () => {
  const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
  try {
    assert.equal(
      await resolveQoderExecutable(undefined, { ...process.env, PATH: emptyDir }),
      undefined
    );
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
  }
});

test("PATH 前目录 qoder 无执行位时跳过并继续搜索后续目录", skipOnWindows, async () => {
  const dir1 = await mkdtemp(join(tmpdir(), "qoder-noexec-"));
  const dir2 = await mkdtemp(join(tmpdir(), "qoder-exec-"));
  try {
    await writeFile(join(dir1, "qoder"), "#!/bin/sh\n", "utf8"); // 无 +x
    const bin2 = join(dir2, "qoder");
    await writeFile(bin2, "#!/bin/sh\n", "utf8");
    await chmod(bin2, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: [dir1, dir2].join(":"),
    });
    assert.equal(found, bin2);
  } finally {
    await rm(dir1, { recursive: true, force: true });
    await rm(dir2, { recursive: true, force: true });
  }
});

test("executableCandidates: Windows 按 PATHEXT 展开候选", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".COM;.EXE" }),
    ["qoder", "qoder.COM", "qoder.EXE"]
  );
});

test("executableCandidates: PATHEXT 条目无点前缀时补点", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: "EXE;.BAT" }),
    ["qoder", "qoder.EXE", "qoder.BAT"]
  );
});

test("executableCandidates: posix 只返回裸名", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(executableCandidates(false, {}), ["qoder"]);
});

test("executableCandidates: PATHEXT 空/点/空白条目被过滤", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".EXE;;.;  ;.BAT" }),
    ["qoder", "qoder.EXE", "qoder.BAT"]
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，报错 `Cannot find module '.../src/lib/resolveQoder.ts'`

- [ ] **Step 3: 实现 resolveQoder.ts**

```ts
import { promises as fs } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const isWindows = process.platform === "win32";

/**
 * Expand "qoder" into the candidate file names to look for in each PATH
 * directory. On Windows this mirrors `where` by appending every PATHEXT
 * extension; elsewhere it is just the literal name.
 */
export function executableCandidates(isWindows: boolean, env: NodeJS.ProcessEnv): string[] {
  if (!isWindows) return ["qoder"];
  const pathext = env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  const exts = pathext
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e !== "" && e !== ".");
  return ["qoder", ...exts.map((ext) => (ext.startsWith(".") ? `qoder${ext}` : `qoder.${ext}`))];
}

// 注：Windows 上 X_OK 等价于存在性检查（Node 语义），与 where 行为一致
async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile()) return false;
    await fs.access(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveQoderExecutable(
  configuredPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  if (configuredPath && configuredPath.trim() !== "") {
    try {
      const stat = await fs.stat(configuredPath);
      if (stat.isFile()) return configuredPath;
    } catch {}
    return undefined;
  }
  // Search PATH natively instead of spawning `which`/`where`: child_process
  // resolves the tool itself against the injected env's PATH, so a test env
  // whose PATH only contains a temp dir makes spawning `which` fail outright.
  // 空条目按未设置处理（不视为 cwd，防御性选择）
  const dirs = (env.PATH ?? "").split(delimiter).filter((d) => d !== "");
  for (const dir of dirs) {
    for (const name of executableCandidates(isWindows, env)) {
      const candidate = resolve(join(dir, name));
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  return undefined;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolveQoder.ts test/resolveQoder.test.ts
git commit -m "feat: qoder 可执行文件解析（配置优先/PATH 兜底）"
```

---

### Task 5: setup.deployFiles —— globalStorage 部署（TDD）

**Files:**
- Test: `test/setup.test.ts`
- Create: `src/setup.ts`

职责：把 hook 源文件（含 `__EDITOR_CONTEXT_REGISTRY__` 占位符）替换注册表路径后部署到 globalStorage，并生成 qoder-settings.json；同版本幂等跳过，版本变化重写。

占位符契约：hook 源码中占位符永远以带双引号形式 `"__EDITOR_CONTEXT_REGISTRY__"` 出现，部署时以 JSON.stringify(registryPath) 整体替换（Task 6 遵守此契约）——JSON.stringify 转义 Windows 反斜杠等字符，保证产物仍是合法 JS 字符串字面量；替换用函数形式，消除 `$&` 等替换模式注入。

- [ ] **Step 1: 写失败测试**

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { deployFiles } from "../src/setup.ts";

async function prepare() {
  const root = await mkdtemp(join(tmpdir(), "setup-"));
  const storageDir = join(root, "storage");
  const resourcesDir = join(root, "resources");
  await mkdir(resourcesDir, { recursive: true });
  const hookSource = join(resourcesDir, "hook.mjs");
  return { root, storageDir, resourcesDir, hookSource };
}

test("首次部署: 生成 hook 与 qoder-settings，占位符被替换为注册表路径", async (t) => {
  const { root, storageDir, hookSource } = await prepare();
  t.after(async () => rm(root, { recursive: true, force: true }));
  const registryPath = join(storageDir, "windows.json");
  await writeFile(hookSource, 'const R = "__EDITOR_CONTEXT_REGISTRY__";\n', "utf8");

  const { hookPath, settingsPath } = await deployFiles(storageDir, hookSource, registryPath, "0.1.0");

  assert.equal(hookPath, join(storageDir, "hook.mjs"));
  assert.equal(settingsPath, join(storageDir, "qoder-settings.json"));
  const hookContent = await readFile(hookPath, "utf8");
  assert.ok(!hookContent.includes("__EDITOR_CONTEXT_REGISTRY__"));
  assert.ok(hookContent.includes(registryPath));

  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  const hookEntry = settings.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(hookEntry.type, "command");
  assert.equal(hookEntry.command, `node "${hookPath}"`);
  assert.equal(hookEntry.timeout, 5);
});

test("同版本重复部署: 不重写文件（mtime 不变）", async (t) => {
  const { root, storageDir, hookSource } = await prepare();
  t.after(async () => rm(root, { recursive: true, force: true }));
  const registryPath = join(storageDir, "windows.json");
  await writeFile(hookSource, "v1", "utf8");
  const first = await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  const before = (await stat(first.hookPath)).mtimeMs;
  await new Promise((r) => setTimeout(r, 20));
  await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  const after = (await stat(first.hookPath)).mtimeMs;
  assert.equal(after, before);
});

test("版本变化: 用新源内容重写", async (t) => {
  const { root, storageDir, hookSource } = await prepare();
  t.after(async () => rm(root, { recursive: true, force: true }));
  const registryPath = join(storageDir, "windows.json");
  await writeFile(hookSource, "old", "utf8");
  await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  await writeFile(hookSource, "new-content", "utf8");
  await deployFiles(storageDir, hookSource, registryPath, "0.2.0");
  assert.equal(await readFile(join(storageDir, "hook.mjs"), "utf8"), "new-content");
});

test("Windows 风格 registryPath: 部署后运行时值与原路径一致", async (t) => {
  const { root, storageDir, hookSource } = await prepare();
  t.after(async () => rm(root, { recursive: true, force: true }));
  const registryPath = "C:\\Users\\tom\\AppData\\Roaming\\Code\\User\\globalStorage\\x\\windows.json";
  await writeFile(hookSource, 'const REGISTRY_FALLBACK = "__EDITOR_CONTEXT_REGISTRY__";\n', "utf8");
  const { hookPath } = await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  // const 声明挂在 VM 全局词法环境、不会成为 sandbox 属性，故取脚本补全值读回运行时值
  const deployed = await readFile(hookPath, "utf8");
  const runtimeValue = runInNewContext(`${deployed}\nREGISTRY_FALLBACK;`, {});
  assert.equal(runtimeValue, registryPath);
});

test("哨兵匹配但产物被删: 同版本重新部署自愈", async (t) => {
  const { root, storageDir, hookSource } = await prepare();
  t.after(async () => rm(root, { recursive: true, force: true }));
  const registryPath = join(storageDir, "windows.json");
  await writeFile(hookSource, "src", "utf8");
  await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  await rm(join(storageDir, "qoder-settings.json"));
  await deployFiles(storageDir, hookSource, registryPath, "0.1.0");
  const settings = JSON.parse(await readFile(join(storageDir, "qoder-settings.json"), "utf8"));
  assert.equal(settings.hooks.UserPromptSubmit[0].hooks[0].type, "command");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，报错 `Cannot find module '.../src/setup.ts'`

- [ ] **Step 3: 实现 setup.ts**

```ts
import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface DeployedFiles {
  hookPath: string;
  settingsPath: string;
}

export async function deployFiles(
  storageDir: string,
  hookSourcePath: string,
  registryPath: string,
  version: string
): Promise<DeployedFiles> {
  const hookPath = join(storageDir, "hook.mjs");
  const settingsPath = join(storageDir, "qoder-settings.json");
  const versionPath = join(storageDir, "deploy-version.txt");

  const current = await fs.readFile(versionPath, "utf8").catch(() => "");
  const upToDate =
    current.trim() === version &&
    (await fileExists(hookPath)) &&
    (await fileExists(settingsPath));

  if (!upToDate) {
    const hookSource = await fs.readFile(hookSourcePath, "utf8");
    // 占位符契约：hook 源码中占位符永远以带双引号形式 "__EDITOR_CONTEXT_REGISTRY__"
    // 出现，部署时以 JSON.stringify(registryPath) 整体替换（转义 Windows 反斜杠等，
    // 函数形式同时消除 $& 等替换模式注入）
    const hookContent = hookSource.replaceAll(
      `"__EDITOR_CONTEXT_REGISTRY__"`,
      () => JSON.stringify(registryPath)
    );
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(hookPath, hookContent);
    await fs.writeFile(settingsPath, JSON.stringify(buildQoderSettings(hookPath), null, 2));
    await fs.writeFile(versionPath, version + "\n");
  }
  return { hookPath, settingsPath };
}

function buildQoderSettings(hookPath: string): unknown {
  return {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: `node "${hookPath}"`, timeout: 5 }],
        },
      ],
    },
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/setup.ts test/setup.test.ts
git commit -m "feat: globalStorage 部署（版本化幂等/占位符替换）"
```

---

### Task 6: hook 脚本 —— UserPromptSubmit 拉取与注入（TDD，集成测试）

**Files:**
- Test: `test/hook.integration.test.ts`
- Create: `src/hook/main.ts`

职责：读 stdin 拿 cwd → 匹配窗口 → 500ms 超时请求 `/context`（带 token）→ 输出 `hookSpecificOutput.additionalContext`；任何失败静默 exit 0。注册表路径来自 `EDITOR_CONTEXT_REGISTRY` 环境变量，回退到部署时烧入的占位符默认值。测试直接以 `node src/hook/main.ts` 运行源码（Node ≥24 type-stripping）。

- [ ] **Step 1: 写失败的集成测试**

```ts
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { saveRegistry, type WindowEntry } from "../src/lib/windowRegistry.ts";

const HOOK_PATH = fileURLToPath(new URL("../src/hook/main.ts", import.meta.url));

const MOCK_CONTEXT = {
  file: "/Users/x/projA/src/app.ts",
  relativePath: "src/app.ts",
  line: 42,
  selection: { startLine: 40, endLine: 45, text: "const a = 1;" },
  dirty: true,
};

interface MockServer {
  port: number;
  close(): Promise<void>;
}

function startMock(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<MockServer> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: (server.address() as { port: number }).port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function runHook(
  stdinJson: object,
  env: Record<string, string>
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK_PATH], { env: { ...process.env, ...env } });
    let stdout = "";
    const guard = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(guard);
      resolve({ code, stdout });
    });
    child.stdin.end(JSON.stringify(stdinJson));
  });
}

function mkEntry(overrides: Partial<WindowEntry> = {}): WindowEntry {
  return {
    windowId: "w1",
    port: 0,
    token: "secret-token",
    workspaceFolders: ["/Users/x/projA"],
    startedAt: 1755230000,
    ...overrides,
  };
}

async function withRegistry(entry: WindowEntry | null): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), "hook-"));
  const path = join(dir, "windows.json");
  if (entry) await saveRegistry(path, { windows: [entry] });
  return { dir, path };
}

test("命中窗口且扩展返回200: 输出合法 hook JSON，含格式化上下文", async (t) => {
  const mock = await startMock((req, res) => {
    if (req.headers["x-editor-token"] === "secret-token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(MOCK_CONTEXT));
    } else {
      res.writeHead(403);
      res.end("{}");
    }
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });

  const { code, stdout } = await runHook({ cwd: "/Users/x/projA/src" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  const ctx = out.hookSpecificOutput;
  assert.equal(ctx.hookEventName, "UserPromptSubmit");
  assert.ok(ctx.additionalContext.includes("src/app.ts"));
  assert.ok(ctx.additionalContext.includes("选区 L40-L45"));
  assert.ok(ctx.additionalContext.includes("const a = 1;"));
});

test("cwd 不匹配任何窗口: 无输出，退出码 0", async (t) => {
  const mock = await startMock((_req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify(MOCK_CONTEXT));
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const { code, stdout } = await runHook({ cwd: "/Users/x/other" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.equal(stdout, "");
});

test("token 不符（扩展返回403）: 无输出，退出码 0", async (t) => {
  const mock = await startMock((_req, res) => {
    res.writeHead(403);
    res.end("{}");
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.equal(stdout, "");
});

test("端口无服务（连接拒绝）: 无输出，退出码 0", async (t) => {
  const { dir, path } = await withRegistry(mkEntry({ port: 1 }));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.equal(stdout, "");
});

test("服务挂起不应答: 500ms 超时后无输出退出，且总耗时明显小于 3s", async (t) => {
  const mock = await startMock(() => {
    /* 故意不响应 */
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const started = Date.now();
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  const elapsed = Date.now() - started;
  assert.equal(code, 0);
  assert.equal(stdout, "");
  assert.ok(elapsed < 3000, `耗时 ${elapsed}ms`);
});

test("最新候选为死端口: 回落到旧候选拿到上下文", async (t) => {
  const mock = await startMock((req, res) => {
    if (req.headers["x-editor-token"] === "secret-token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(MOCK_CONTEXT));
    } else {
      res.writeHead(403);
      res.end("{}");
    }
  });
  const dir = await mkdtemp(join(tmpdir(), "hook-"));
  const path = join(dir, "windows.json");
  const deadNew = mkEntry({ windowId: "dead-new", port: 1, startedAt: 9000 });
  const aliveOld = mkEntry({ windowId: "alive-old", port: mock.port, startedAt: 1000 });
  await saveRegistry(path, { windows: [aliveOld, deadNew] });
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.ok(stdout.includes("src/app.ts"));
});

test("200 但响应形状非法: 静默跳过，无输出", async (t) => {
  const mock = await startMock((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.equal(stdout, "");
});

test("滴流响应超过总时限: 静默放弃，总耗时 < 3s", async (t) => {
  const mock = await startMock((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write('{"file":');
    const timer = setInterval(() => res.write(" "), 200);
    req.on("close", () => clearInterval(timer));
  });
  const { dir, path } = await withRegistry(mkEntry({ port: mock.port }));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const started = Date.now();
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.equal(stdout, "");
  assert.ok(Date.now() - started < 3000);
});
```

追加用例（验证多候选迭代跳过死条目）：注册表含 [死端口旧条目, 正常 mock 新条目] 时，hook 仍能从 mock 拿到上下文（验证跳过死条目）。

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，报错 `Cannot find module '.../src/hook/main.ts'`

- [ ] **Step 3: 实现 src/hook/main.ts**

```ts
import { get } from "node:http";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatContext, type EditorContext } from "../lib/formatContext.ts";
import { findWindowsForCwd, loadRegistry, type WindowEntry } from "../lib/windowRegistry.ts";

const REGISTRY_FALLBACK = "__EDITOR_CONTEXT_REGISTRY__";
const REQUEST_TIMEOUT_MS = 500;
const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function buildHookOutput(context: EditorContext): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: formatContext(context),
    },
  });
}

function isEditorContext(value: unknown): value is EditorContext {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.file === "string" &&
    typeof c.relativePath === "string" &&
    typeof c.line === "number" &&
    typeof c.dirty === "boolean" &&
    (c.selection === null ||
      (typeof c.selection === "object" &&
        c.selection !== null &&
        typeof (c.selection as Record<string, unknown>).startLine === "number" &&
        typeof (c.selection as Record<string, unknown>).endLine === "number" &&
        typeof (c.selection as Record<string, unknown>).text === "string"))
  );
}

function fetchContext(entry: WindowEntry): Promise<EditorContext> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = get(
      {
        host: "127.0.0.1",
        port: entry.port,
        path: "/context",
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "X-Editor-Token": entry.token },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (c: Buffer) => {
          received += c.length;
          if (received > MAX_RESPONSE_BYTES || Date.now() - startedAt > REQUEST_TIMEOUT_MS * 2) {
            req.destroy(new Error("response exceeds limit"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (isEditorContext(parsed)) resolve(parsed);
            else reject(new Error("invalid context shape"));
          } catch (err) {
            reject(err as Error);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export async function main(): Promise<void> {
  const registryPath = process.env.EDITOR_CONTEXT_REGISTRY ?? REGISTRY_FALLBACK;
  let cwd = process.cwd();
  try {
    const input: unknown = JSON.parse(await readStdin());
    if (typeof (input as { cwd?: unknown })?.cwd === "string" && (input as { cwd: string }).cwd) {
      cwd = (input as { cwd: string }).cwd;
    }
  } catch {}
  const candidates = findWindowsForCwd(await loadRegistry(registryPath), cwd);
  for (const entry of candidates) {
    const context = await fetchContext(entry).catch(() => undefined);
    if (context) {
      process.stdout.write(buildHookOutput(context));
      return;
    }
  }
}

async function isDirectRun(): Promise<boolean> {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    const self = await realpath(fileURLToPath(import.meta.url));
    return self === (await realpath(invoked));
  } catch {
    return false;
  }
}

if (await isDirectRun()) {
  try {
    await main();
  } catch (err) {
    if (process.env.EDITOR_CONTEXT_DEBUG) {
      process.stderr.write(`${err}\n`);
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 全部 PASS（含 hook 集成 5 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/hook/main.ts test/hook.integration.test.ts
git commit -m "feat: UserPromptSubmit hook（cwd 匹配/500ms 超时/静默降级）"
```

---

### Task 7: VSCode 集成层 —— contextServer / terminalProfile / extension 接线

**Files:**
- Create: `src/contextServer.ts`
- Create: `src/terminalProfile.ts`
- Modify: `src/extension.ts`（替换 Task 1 的 stub）

说明：此层依赖 vscode API，按设计文档 §8 不写单测（纯逻辑已全部抽到 lib 并在前序任务覆盖），由 typecheck + Task 10 端到端验证。

- [ ] **Step 1: 实现 src/contextServer.ts**

```ts
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import * as vscode from "vscode";
import { loadRegistry, removeWindow, saveRegistry, upsertWindow } from "./lib/windowRegistry.ts";
import type { EditorContext } from "./lib/formatContext.ts";

export interface RunningServer {
  windowId: string;
  port: number;
  token: string;
  dispose(): Promise<void>;
}

export async function startContextServer(context: vscode.ExtensionContext): Promise<RunningServer> {
  const registryPath = join(context.globalStorageUri.fsPath, "windows.json");
  const windowId = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("hex");
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);

  let server: Server | undefined;
  for (let attempt = 0; attempt < 2 && !server; attempt++) {
    const candidate = createServer((req, res) => handleRequest(req, res, token));
    try {
      await listen(candidate);
      server = candidate;
    } catch {
      candidate.close();
    }
  }
  if (!server) throw new Error("editor-context: 无法绑定本地端口");
  const port = (server.address() as { port: number }).port;

  const entry = {
    windowId,
    port,
    token,
    workspaceFolders,
    startedAt: Math.floor(Date.now() / 1000),
  };
  const registry = await loadRegistry(registryPath);
  await saveRegistry(registryPath, upsertWindow(registry, entry));

  // 多窗口同时激活时后保存者可能覆盖先保存者的条目（读-改-写竞态）：
  // 每次窗口重新获得焦点时重写自己的条目，实现自愈补偿
  const rewriteEntry = async (): Promise<void> => {
    const current = await loadRegistry(registryPath);
    await saveRegistry(registryPath, upsertWindow(current, entry));
  };
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) void rewriteEntry();
    })
  );

  async function dispose(): Promise<void> {
    server?.close();
    const current = await loadRegistry(registryPath);
    await saveRegistry(registryPath, removeWindow(current, windowId));
  }
  return { windowId, port, token, dispose };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse, token: string): void {
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET" || req.url !== "/context") {
    send(404, { error: "not found" });
    return;
  }
  if (req.headers["x-editor-token"] !== token) {
    send(403, { error: "forbidden" });
    return;
  }
  const ctx = buildContext();
  if (!ctx) {
    send(404, { error: "no active editor" });
    return;
  }
  send(200, ctx);
}

function buildContext(): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const { document, selection } = editor;
  if (document.uri.scheme !== "file") return undefined;
  let sel: EditorContext["selection"] = null;
  if (!selection.isEmpty) {
    sel = {
      startLine: selection.start.line + 1,
      endLine: selection.end.line + 1,
      text: document.getText(selection),
    };
  }
  return {
    file: document.uri.fsPath,
    relativePath: vscode.workspace.asRelativePath(document.uri, false),
    line: selection.active.line + 1,
    selection: sel,
    dirty: document.isDirty,
  };
}
```

- [ ] **Step 2: 实现 src/terminalProfile.ts**

```ts
import * as vscode from "vscode";
import { resolveQoderExecutable } from "./lib/resolveQoder.ts";

const TERMINAL_NAME = "Qoder CLI";

export const OPEN_TERMINAL_COMMAND = "qoder-cli.openTerminal";

function findExistingTerminal(): vscode.Terminal | undefined {
  return vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
}

async function resolveQoderPath(): Promise<string | undefined> {
  const configured = vscode.workspace
    .getConfiguration("qoder")
    .get<string>("executablePath", "");
  return resolveQoderExecutable(configured.trim() === "" ? undefined : configured);
}

function warnMissingQoder(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: 未找到 qoder 可执行文件，请在设置中配置 qoder.executablePath"
  );
}

function warnSettingsDeployFailed(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: 上下文功能部署失败（可能磁盘/权限问题），本终端暂无法注入编辑器上下文。请尝试 Reload Window 或重装扩展"
  );
}

function terminalOptions(settingsPath: string, qoderPath: string): vscode.TerminalOptions {
  return {
    name: TERMINAL_NAME,
    location: vscode.TerminalLocation.Panel,
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    shellPath: qoderPath,
    shellArgs: ["--settings", settingsPath],
  };
}

export function registerQoderTerminalProfile(
  context: vscode.ExtensionContext,
  settingsPath: string | undefined
): void {
  const provider: vscode.TerminalProfileProvider = {
    async provideTerminalProfile(
      _token: vscode.CancellationToken
    ): Promise<vscode.TerminalProfile | undefined> {
      const existing = findExistingTerminal();
      if (existing) {
        existing.show();
        return undefined;
      }
      if (settingsPath === undefined) {
        warnSettingsDeployFailed();
        return undefined;
      }
      const qoderPath = await resolveQoderPath();
      if (!qoderPath) {
        warnMissingQoder();
        return undefined;
      }
      return new vscode.TerminalProfile(terminalOptions(settingsPath, qoderPath));
    },
  };
  context.subscriptions.push(vscode.window.registerTerminalProfileProvider("qoder-cli", provider));
}

export async function openQoderTerminal(settingsPath: string | undefined): Promise<void> {
  const existing = findExistingTerminal();
  if (existing) {
    existing.show();
    return;
  }
  if (settingsPath === undefined) {
    warnSettingsDeployFailed();
    return;
  }
  const qoderPath = await resolveQoderPath();
  if (!qoderPath) {
    warnMissingQoder();
    return;
  }
  const terminal = vscode.window.createTerminal(terminalOptions(settingsPath, qoderPath));
  terminal.show();
}
```

- [ ] **Step 3: 替换 src/extension.ts**

```ts
import { join } from "node:path";
import * as vscode from "vscode";
import { startContextServer } from "./contextServer.ts";
import { registerQoderTerminalProfile, openQoderTerminal, OPEN_TERMINAL_COMMAND as QODER_OPEN_COMMAND } from "./terminalProfile.ts";
import { deployFiles } from "./setup.ts";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storageDir = context.globalStorageUri.fsPath;
  const registryPath = join(storageDir, "windows.json");
  const hookSource = join(context.extensionPath, "dist", "hook.mjs");
  const version = String(context.extension.packageJSON.version ?? "0");

  let settingsPath: string | undefined;
  try {
    settingsPath = (await deployFiles(storageDir, hookSource, registryPath, version)).settingsPath;
  } catch (err) {
    console.error("editor-context: hook 部署失败，终端 profile 以降级模式注册", err);
  }
  try {
    const server = await startContextServer(context);
    context.subscriptions.push({ dispose: () => void server.dispose() });
  } catch (err) {
    console.error("editor-context: 上下文服务启动失败，仅注册终端 profile", err);
  }
  registerQoderTerminalProfile(context, settingsPath);
  context.subscriptions.push(
    vscode.commands.registerCommand(QODER_OPEN_COMMAND, () => void openQoderTerminal(settingsPath))
  );
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusItem.text = "$(terminal) Qoder";
  statusItem.tooltip = "打开 Qoder CLI 终端（自动注入编辑器上下文）";
  statusItem.command = QODER_OPEN_COMMAND;
  statusItem.show();
  context.subscriptions.push(statusItem);
}

export function deactivate(): void {}
```

- [ ] **Step 4: typecheck 通过**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && npm run typecheck && npm test`
Expected: typecheck 无输出退出 0；既有测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/contextServer.ts src/terminalProfile.ts src/extension.ts
git commit -m "feat: VSCode 集成层（上下文服务/终端profile/接线）"
```

---

### Task 8: 构建与打包 —— esbuild 双入口 + vsce 冒烟

**Files:**
- Create: `esbuild.js`

- [ ] **Step 1: 写 esbuild.js**

```js
const esbuild = require("esbuild");
const { readFile, rm } = require("node:fs/promises");
const { Script } = require("node:vm");

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  external: ["vscode"],
  minify: false,
  sourcemap: true,
  logLevel: "info",
};

async function assertHookBundle() {
  const code = await readFile("dist/hook.mjs", "utf8");
  if (!code.includes('"__EDITOR_CONTEXT_REGISTRY__"')) {
    throw new Error('dist/hook.mjs 缺少占位符 "__EDITOR_CONTEXT_REGISTRY__"（带双引号）——检查 esbuild quote-style 配置');
  }
  if (!code.includes("import.meta.url")) {
    throw new Error("dist/hook.mjs 缺少 import.meta.url——isDirectRun 会失效");
  }
}

async function assertExtensionBundle() {
  const code = await readFile("dist/extension.js", "utf8");
  try {
    new Script(code);
  } catch (err) {
    throw new Error(`dist/extension.js 不是合法 CJS（可能被配置成 esm 格式）: ${err.message}`);
  }
}

async function main() {
  // dist 完全由构建生成：先清理孤儿文件，避免陈旧产物被 vsce 打进 vsix
  await rm("dist", { recursive: true, force: true });
  await esbuild.build({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    format: "cjs",
  });
  await esbuild.build({
    ...common,
    entryPoints: ["src/hook/main.ts"],
    outfile: "dist/hook.mjs",
    format: "esm",
  });
  await assertHookBundle();
  await assertExtensionBundle();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 构建并验证产物**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && npm run build && ls dist/ && node -e "import('./dist/hook.mjs').then(m => console.log(typeof m.main))"`
Expected: `dist/` 含 `extension.js`、`extension.js.map`、`hook.mjs`、`hook.mjs.map`；node 命令输出 `function`

附加要求：构建脚本需附带断言：dist/hook.mjs 中包含 `"__EDITOR_CONTEXT_REGISTRY__"`（带双引号）与 `import.meta.url`，防止 quote-style/target 配置漂移静默破坏占位符契约（esbuild target 不得低于 es2022，顶层 await 约束）

- [ ] **Step 3: vsce 打包冒烟**

Run: `npm run package && ls *.vsix`
Expected: 生成 `qodercli-contextbridge-0.1.0.vsix`（可能有 icon/repository 警告，允许）

- [ ] **Step 4: 全量测试回归**

Run: `npm test && npm run typecheck`
Expected: 全部 PASS、退出码 0

- [ ] **Step 5: Commit**

```bash
git add esbuild.js
git commit -m "build: esbuild 双入口（extension.js/hook.mjs）与打包脚本"
```

（`*.vsix`、`dist/` 已被 .gitignore 排除，不会入库）

---

### Task 9: README 与 CI

**Files:**
- Modify: `README.md`（替换占位内容）
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 写 README.md**

```markdown
# vscode-editor-context

为 [Qoder CLI](https://docs.qoder.com) 注入 VSCode 实时编辑器上下文的扩展。

安装后：点击终端面板 `+` 下拉中的 **Qoder CLI**，即可在面板终端里启动一个自动带编辑器上下文的 qoder 会话。你在编辑器里打开的文件、光标行号、选中的代码，会在每次发送消息时实时注入对话——全程无感。

## 特性

- **开箱即用**：安装即用，零配置
- **零侵入**：不修改 `~/.qoder/settings.json`，不修改任何项目文件；卸载扩展即完全消失
- **实时拉取**：上下文在每次发送消息的瞬间从编辑器读取，永远最新
- **多窗口安全**：按工作目录严格匹配 VSCode 窗口，多项目并行互不串扰

## 安装

```bash
# 1. 安装扩展
code --install-extension qodercli-contextbridge-0.1.0.vsix
# 2. 重启 VSCode（或 Reload Window）
```

前置要求：VSCode ≥ 1.85，已安装 Qoder CLI 与 Node.js（≥ 18）。

若 `qoder` 不在 PATH 中，安装后在设置里配置 `qoder.executablePath` 为其绝对路径。

从 [Releases](../../releases) 下载最新 `.vsix`。

## 使用

1. 打开一个项目文件夹
2. 三种打开方式任选：状态栏左侧的 "Qoder" 按钮（一键）、快捷键 Cmd+Alt+Q（Windows/Linux 为 Ctrl+Shift+Q）、或终端面板 `+` 旁下拉选择 "Qoder CLI"
3. 选中一段代码，在终端里直接问："我在看哪一行？"——回答应包含文件名与行号

## 工作原理

```
┌─ VSCode 扩展 ─────────────┐        ┌─ qoder CLI 会话 ────────┐
│ 127.0.0.1:/context (只读) │ ◄────  │ UserPromptSubmit hook   │
│ windows.json 窗口注册      │  token │ 按 cwd 匹配本窗口       │
└────────────────────────────┘        └─────────────────────────┘
```

扩展通过启动参数 `qoder --settings <扩展自管理配置>` 仅为该会话注入一个 `UserPromptSubmit` hook（深度合并，不影响你的其他配置）。hook 在你每次发送消息时实时请求扩展获取编辑器状态，并以 `additionalContext` 附加到提示中。

## 已知限制

- 若你自己配置过 `UserPromptSubmit` hook，在扩展启动的会话中会被本扩展的配置覆盖（其他事件类型不受影响）
- 上下文在发送消息的瞬间快照；会话中途切换编辑器后，需下一条消息才会反映新状态
- 每个窗口同时只有一个 "Qoder CLI" 终端（再次点击会聚焦已有终端而非新建）
- 窗口异常退出可能在注册表留下失效条目：无害（hook 自动跳过），卸载扩展即清除
- 多窗口同时启动时理论上存在注册表并发写丢失更新（窗口重新获得焦点或 Reload 时自愈）
- 本地 HTTP 服务仅绑定 127.0.0.1 并要求随机 token（尽力而为级防护，与同类方案一致）

## 验证清单（端到端）

- [ ] 选中代码发问，回答包含正确文件与行号
- [ ] 切换到另一个文件后再问，回答随新文件更新
- [ ] 取消选中后再问，回答不再包含选区
- [ ] 两个 VSCode 窗口开不同项目，各自终端回答各自的文件
- [ ] 在普通终端直接运行 `qoder`，不注入编辑器上下文
- [ ] 修改文件不保存再问，回答标注"未保存"
- [ ] 卸载扩展后，globalStorage 下的 `yushuailong.qodercli-contextbridge` 目录（含 hook.mjs、qoder-settings.json、windows.json、deploy-version.txt）被清除，且扩展安装目录已移除

## 开发

```bash
npm install
npm test            # node:test，Node >= 24
npm run typecheck
npm run build       # dist/extension.js + dist/hook.mjs
npm run package     # 产出 .vsix
```

调试：F5 启动扩展开发宿主（需先 `npm run build`；改代码后重新 build 再 Reload）。hook 失败默认静默，设 `EDITOR_CONTEXT_DEBUG=1` 可在 stderr 看到错误。

## License

MIT
```

- [ ] **Step 2: 写 .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run package
      - uses: actions/upload-artifact@v4
        with:
          name: vscode-editor-context-${{ matrix.os }}
          path: "*.vsix"
```

注意：resolveQoder 的 PATH 搜索用例在 Windows 上 skip（posix only）；executableCandidates 单测跨平台运行，CI 的 windows-latest 仍会跑其余测试验证跨平台可运行性。

- [ ] **Step 3: 本地验证 CI 等价命令**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && npm run typecheck && npm test && npm run build`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/ci.yml
git commit -m "docs+ci: README（原理/限制/验证清单）与三平台 CI"
```

---

### Task 10: 端到端手动验证

**Files:** 无新文件（验证任务；GUI 操作需在用户机器上人工执行）

- [ ] **Step 1: 安装扩展**

Run: `cd /Users/yushuailong/workspace/vscode-editor-context && code --install-extension qodercli-contextbridge-0.1.0.vsix`
Expected: 输出 `Successfully installed`

- [ ] **Step 2: Reload VSCode 并验证注册文件**

操作：Reload Window（Cmd+Shift+P → "Developer: Reload Window"）
Run: `ls ~/Library/Application\ Support/Code/User/globalStorage/yushuailong.qodercli-contextbridge/ 2>/dev/null || find ~/.vscode/extensions -maxdepth 1 -name "*editor-context*" -exec ls {}/ \; 2>/dev/null`
Expected: 能找到 `hook.mjs`、`qoder-settings.json`、`windows.json`、`deploy-version.txt`（globalStorage 实际路径以扩展宿主为准；若找不到，在 VSCode 里打开任一文件夹后再查——扩展激活以窗口为单位）

- [ ] **Step 3: 执行 README 验证清单（核心 4 项，需 GUI，请用户配合）**

逐项执行并记录结果：
1. 打开任一项目 → 终端下拉选 "Qoder CLI" → 终端自动运行 qoder
2. 选中一段代码，问"我在看哪个文件哪几行" → 回答应含正确文件与行号
3. 切换文件再问 → 回答更新为新文件
4. 打开普通集成终端手动运行 `qoder`，问同样问题 → 应回答"不知道/未提供编辑器上下文"（证明零侵入）

Expected: 4 项全部符合。任何一项失败：设 `EDITOR_CONTEXT_DEBUG=1`（写入 qoder-settings.json 的 command 前缀 `EDITOR_CONTEXT_DEBUG=1 node ...`）重启会话复现，按 spec §5 边界表排查

- [ ] **Step 4: 验证结果记入会话，修复发现的问题后重跑**

如全部通过：报告完成。如有失败：定位到具体子系统（server/registry/hook/terminal），修复后从 Step 1 重跑（`code --uninstall-extension yushuailong.qodercli-contextbridge` 后重装新 vsix）。

- [ ] **Step 5: 最终 commit（如有修复）并汇总**

```bash
git add -A
git commit -m "fix: 端到端验证发现的问题修复"
```

---

## Self-Review 记录

- **Spec 覆盖**：§2 体验流程→T7/T10；§4.2 注册表→T2+T7；§4.3 部署→T5；§4.4 HTTP→T7；§4.5 hook→T6；§4.6 终端→T7；§5 边界→T2/T6 测试+T7 代码（404/403/retry）；§6 安全→T7（127.0.0.1+token）+T6（token 头）；§7 限制→T9 README；§8 测试→T2-T6/T9/T10。无遗漏。
- **占位符扫描**：无 TBD/TODO；`__EDITOR_CONTEXT_REGISTRY__` 是设计内的运行时占位符（T5 替换），非遗留。
- **类型一致性**：`EditorContext`/`WindowEntry` 字段在 T2/T3/T6/T7 一致；`deployFiles(storageDir, hookSourcePath, registryPath, version)` 签名与 T7 extension.ts 调用一致；`resolveQoderExecutable(configuredPath?, env?)` 与 T4 测试、T7 调用一致；产物名 `dist/hook.mjs` 在 T5(测试用临时源)/T7(extension 引用 dist/hook.mjs)/T8(esbuild outfile) 一致。
