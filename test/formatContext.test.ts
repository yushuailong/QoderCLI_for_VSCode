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
    openFiles: [],
    ...overrides,
  };
}

test("归属行始终第一行", () => {
  assert.ok(
    formatContext(mkCtx()).startsWith("[Editor context injected by QoderCLI ContextBridge]\n")
  );
});

test("无选区: Active 单行，无围栏", () => {
  const out = formatContext(mkCtx());
  assert.equal(out.split("\n")[1], "Active: src/app.ts — cursor L42");
  assert.equal(out.split("\n").length, 2);
  assert.ok(!out.includes("```"));
});

test("dirty: (unsaved) 标记", () => {
  assert.ok(formatContext(mkCtx({ dirty: true })).includes("Active: src/app.ts (unsaved) — cursor L42"));
});

test("有选区: selection 行号与围栏", () => {
  const out = formatContext(mkCtx({ selection: { startLine: 40, endLine: 45, text: "const a = 1;" } }));
  assert.ok(out.includes("Active: src/app.ts — cursor L42, selection L40-L45:"));
  assert.ok(out.includes("```ts\nconst a = 1;\n```"));
});

test("完整示例: 目标格式逐行一致", () => {
  const out = formatContext(
    mkCtx({
      dirty: true,
      selection: { startLine: 40, endLine: 45, text: "const a = 1;" },
      openFiles: [
        { relativePath: "src/lib/a.ts", dirty: true },
        { relativePath: "src/lib/b.ts", dirty: false },
        { relativePath: "package.json", dirty: false },
      ],
    })
  );
  assert.equal(
    out,
    [
      "[Editor context injected by QoderCLI ContextBridge]",
      "Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:",
      "```ts",
      "const a = 1;",
      "```",
      "Open files (3): src/lib/a.ts (unsaved), src/lib/b.ts, package.json",
    ].join("\n")
  );
});

test("未知扩展名: 围栏为无语言标注", () => {
  const out = formatContext(
    mkCtx({ file: "/Users/x/projA/Makefile", relativePath: "Makefile",
      selection: { startLine: 1, endLine: 2, text: "all:" } })
  );
  assert.ok(out.includes("```\nall:\n```"));
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

test("超长选区: 截断至 2000 字符并英文标注", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 99, text: "a".repeat(2500) } })
  );
  assert.ok(out.includes("…(selection truncated to 2000 characters)"));
  assert.ok(!out.includes("a".repeat(2001)));
});

test("选区恰好 2000 字符: 不截断无标注", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 9, text: "a".repeat(2000) } })
  );
  assert.ok(!out.includes("truncated"));
  assert.ok(out.includes("a".repeat(2000)));
});

test("选区 2001 字符: 截断且标注位于代码块内（闭合围栏之前）", () => {
  const out = formatContext(
    mkCtx({ selection: { startLine: 1, endLine: 9, text: "a".repeat(2001) } })
  );
  const lines = out.split("\n");
  const closingIdx = lines.findIndex((l, i) => i > 0 && l === "```");
  const noteIdx = lines.findIndex((l) => l.includes("truncated"));
  assert.ok(closingIdx !== -1 && noteIdx !== -1 && noteIdx < closingIdx);
});

test("open files: 列出并排除活动文件，dirty 标记", () => {
  const out = formatContext(
    mkCtx({
      openFiles: [
        { relativePath: "src/app.ts", dirty: false },
        { relativePath: "src/lib/a.ts", dirty: true },
        { relativePath: "package.json", dirty: false },
      ],
    })
  );
  assert.ok(out.includes("Open files (2): src/lib/a.ts (unsaved), package.json"));
});

test("open files 为空: 无 Open files 行", () => {
  assert.ok(!formatContext(mkCtx()).includes("Open files"));
});

test("open files 恰好 15 个: 全部列出无截断标注", () => {
  const openFiles = Array.from({ length: 15 }, (_, i) => ({ relativePath: `f${i}.ts`, dirty: false }));
  const out = formatContext(mkCtx({ openFiles }));
  assert.ok(out.includes("Open files (15): f0.ts,"));
  assert.ok(out.includes("f14.ts"));
  assert.ok(!out.includes("more"));
});

test("open files 超过 15 个: 截断并标注", () => {
  const openFiles = Array.from({ length: 20 }, (_, i) => ({ relativePath: `f${i}.ts`, dirty: false }));
  const out = formatContext(mkCtx({ openFiles }));
  assert.ok(out.includes("Open files (15):"));
  assert.ok(out.includes("… and 5 more"));
  assert.ok(!out.includes("f19.ts"));
});
