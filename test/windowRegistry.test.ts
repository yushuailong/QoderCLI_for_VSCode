import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  findWindowForCwd,
  findWindowsForCwd,
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

test("findWindowForCwd: 同目录新旧条目并存时优先最新（死条目不遮蔽）", () => {
  const stale = mkEntry({ windowId: "stale", startedAt: 1000 });
  const fresh = mkEntry({ windowId: "fresh", startedAt: 2000 });
  const registry = { windows: [stale, fresh] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projA")?.windowId, "fresh");
});

test("findWindowsForCwd: 返回全部匹配并按 startedAt 新到旧排序", () => {
  const stale = mkEntry({ windowId: "stale", startedAt: 1000 });
  const fresh = mkEntry({ windowId: "fresh", startedAt: 2000 });
  const other = mkEntry({ windowId: "other", startedAt: 3000, workspaceFolders: ["/Users/x/other"] });
  const registry = { windows: [stale, fresh, other] };
  assert.deepEqual(
    findWindowsForCwd(registry, "/Users/x/projA").map((w) => w.windowId),
    ["fresh", "stale"]
  );
});

test("findWindowForCwd: Windows 盘符大小写不敏感命中", () => {
  const registry = { windows: [mkEntry({ workspaceFolders: ["C:\\Work\\ProjA"] })] };
  assert.equal(findWindowForCwd(registry, "c:\\work\\projA\\src")?.windowId, "w1");
});

test("findWindowForCwd: POSIX 路径保持大小写敏感", () => {
  const registry = { windows: [mkEntry()] };
  assert.equal(findWindowForCwd(registry, "/Users/x/ProjA"), undefined);
});

test("findWindowForCwd: folder 尾斜杠时子目录命中", () => {
  const registry = { windows: [mkEntry({ workspaceFolders: ["/Users/x/projA/"] })] };
  assert.equal(findWindowForCwd(registry, "/Users/x/projA/src")?.windowId, "w1");
});
