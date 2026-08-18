import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("package.json: 命令/快捷键/profile 声明与扩展常量一致", async () => {
  const manifest = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
  const commands = manifest.contributes.commands.map((c: { command: string }) => c.command);
  assert.ok(commands.includes("qoder-cli.openTerminal"));
  assert.equal(manifest.contributes.keybindings.length, 1);
  assert.equal(manifest.contributes.keybindings[0].command, "qoder-cli.openTerminal");
  assert.equal(manifest.contributes.keybindings[0].key, "ctrl+shift+q");
  assert.equal(manifest.contributes.keybindings[0].mac, "cmd+alt+q");
  assert.equal(manifest.contributes.terminal.profiles[0].id, "qoder-cli");
  assert.equal(manifest.activationEvents.includes("onStartupFinished"), true);
  assert.deepEqual(manifest.extensionKind, ["workspace"]);
});

test("package.json: 品牌化字段（name/displayName/icon）", async () => {
  const manifest = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(manifest.name, "qodercli-for-vscode");
  assert.equal(manifest.displayName, "QoderCLI for VS Code");
  assert.equal(manifest.icon, "media/icon.png");
});
