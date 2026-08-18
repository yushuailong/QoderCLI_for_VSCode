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
  openFiles: [{ relativePath: "src/lib/a.ts", dirty: true }],
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
  assert.ok(ctx.additionalContext.includes("QoderCLI for VS Code"));
  assert.ok(ctx.additionalContext.includes("selection L40-L45"));
  assert.ok(ctx.additionalContext.includes("const a = 1;"));
  assert.ok(ctx.additionalContext.includes("src/lib/a.ts (unsaved)"));
});

test("旧版响应无 openFiles: 容错接受，无 Open files 行", async (t) => {
  const { openFiles: _omit, ...legacy } = MOCK_CONTEXT;
  const mock = await startMock((req, res) => {
    if (req.headers["x-editor-token"] === "secret-token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(legacy));
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
  const ctx = JSON.parse(stdout).hookSpecificOutput;
  assert.ok(ctx.additionalContext.includes("Active: src/app.ts (unsaved) — cursor L42"));
  assert.ok(!ctx.additionalContext.includes("Open files"));
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

test("服务挂起不应答: 2000ms 超时后无输出退出，且总耗时明显小于 5s hook 预算", async (t) => {
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
  assert.ok(elapsed < 4000, `耗时 ${elapsed}ms`);
});

test("死端口旧条目在前: 跳过后从新条目拿到上下文", async (t) => {
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
  const stale = mkEntry({ windowId: "stale", port: 1, startedAt: 1000 });
  const fresh = mkEntry({ windowId: "fresh", port: mock.port, startedAt: 2000 });
  await saveRegistry(path, { windows: [stale, fresh] });
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    await mock.close();
  });
  const { code, stdout } = await runHook({ cwd: "/Users/x/projA" }, { EDITOR_CONTEXT_REGISTRY: path });
  assert.equal(code, 0);
  assert.ok(stdout.includes("src/app.ts"));
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

test("滴流响应超过总时限: 静默放弃，总耗时 < 5s hook 预算", async (t) => {
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
  assert.ok(Date.now() - started < 5000);
});
