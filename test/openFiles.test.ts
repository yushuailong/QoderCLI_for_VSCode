import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenFiles, type DocumentLike, type TabLike } from "../src/lib/openFiles.ts";

function mkTab(uri: string): TabLike {
  return { input: { uri: { toString: () => uri } } };
}

function mkDoc(uri: string, isDirty: boolean): DocumentLike {
  return { uri: { toString: () => uri }, isDirty };
}

// 谓词仿 vscode 层：TextInput 以是否含 uri 属性判别、scheme 以 file: 前缀判别
function run(
  tabs: TabLike[],
  textDocuments: DocumentLike[] = [],
  opts: { activeUri?: string; nonFileSchemes?: string[] } = {}
) {
  return buildOpenFiles(
    tabs,
    textDocuments,
    (s) => s === opts.activeUri,
    (input) => typeof input === "object" && input !== null && "uri" in input,
    (s) => s,
    (s) => !opts.nonFileSchemes?.some((scheme) => s.startsWith(`${scheme}:`))
  );
}

test("非 TextInput 的 tab 被跳过", () => {
  const outputTab: TabLike = { input: { outputUri: { toString: () => "output:extension" } } };
  const terminalTab: TabLike = { input: { terminalId: 1 } };
  const result = run([outputTab, terminalTab, mkTab("file:///a.ts")]);
  assert.deepEqual(result, [{ relativePath: "file:///a.ts", dirty: false }]);
});

test("非 file scheme 的 tab 被跳过", () => {
  const result = run(
    [mkTab("file:///a.ts"), mkTab("untitled:Untitled-1"), mkTab("git:/commit/")],
    [],
    { nonFileSchemes: ["untitled", "git"] }
  );
  assert.deepEqual(result, [{ relativePath: "file:///a.ts", dirty: false }]);
});

test("同 URI 多 tab（split 视图）只保留一条", () => {
  const result = run([mkTab("file:///a.ts"), mkTab("file:///b.ts"), mkTab("file:///a.ts")]);
  assert.deepEqual(result, [
    { relativePath: "file:///a.ts", dirty: false },
    { relativePath: "file:///b.ts", dirty: false },
  ]);
});

test("活动文件被排除", () => {
  const result = run([mkTab("file:///a.ts"), mkTab("file:///b.ts")], [], { activeUri: "file:///a.ts" });
  assert.deepEqual(result, [{ relativePath: "file:///b.ts", dirty: false }]);
});

test("dirty 状态按 URI 映射，未命中默认 false", () => {
  const docs = [mkDoc("file:///a.ts", true), mkDoc("file:///b.ts", false)];
  const result = run([mkTab("file:///a.ts"), mkTab("file:///b.ts"), mkTab("file:///c.ts")], docs);
  assert.deepEqual(result, [
    { relativePath: "file:///a.ts", dirty: true },
    { relativePath: "file:///b.ts", dirty: false },
    { relativePath: "file:///c.ts", dirty: false },
  ]);
});

test("顺序按 tab 遍历顺序保留", () => {
  const result = run([mkTab("file:///z.ts"), mkTab("file:///a.ts"), mkTab("file:///m.ts")]);
  assert.deepEqual(
    result.map((f) => f.relativePath),
    ["file:///z.ts", "file:///a.ts", "file:///m.ts"]
  );
});

test("空 tab 列表返回空数组", () => {
  assert.deepEqual(run([]), []);
});
