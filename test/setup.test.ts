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
