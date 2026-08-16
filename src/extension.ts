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
