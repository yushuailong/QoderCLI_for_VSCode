import { join } from "node:path";
import * as vscode from "vscode";
import { startContextServer } from "./contextServer.ts";
import {
  registerQoderTerminalProfile,
  openQoderTerminal,
  openQoderSettingsFile,
  OPEN_TERMINAL_COMMAND as QODER_OPEN_COMMAND,
  OPEN_SETTINGS_FILE_COMMAND as QODER_OPEN_SETTINGS_COMMAND,
} from "./terminalProfile.ts";
import { deployFiles, type DeployedFiles } from "./setup.ts";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storageDir = context.globalStorageUri.fsPath;
  const registryPath = join(storageDir, "windows.json");
  const hookSource = join(context.extensionPath, "dist", "hook.mjs");
  const version = String(context.extension.packageJSON.version ?? "0");

  let deployed: DeployedFiles | undefined;
  try {
    deployed = await deployFiles(storageDir, hookSource, registryPath, version);
  } catch (err) {
    console.error("editor-context: hook 部署失败，终端 profile 以降级模式注册", err);
  }
  try {
    const server = await startContextServer(context);
    context.subscriptions.push({ dispose: () => void server.dispose() });
  } catch (err) {
    console.error("editor-context: 上下文服务启动失败，仅注册终端 profile", err);
  }
  registerQoderTerminalProfile(context, deployed);
  context.subscriptions.push(
    vscode.commands.registerCommand(QODER_OPEN_COMMAND, () => void openQoderTerminal(deployed))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(QODER_OPEN_SETTINGS_COMMAND, () => openQoderSettingsFile(deployed))
  );
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusItem.text = "$(terminal) Qoder CLI";
  statusItem.tooltip = "Open a Qoder CLI terminal (editor context injected automatically)";
  statusItem.command = QODER_OPEN_COMMAND;
  statusItem.show();
  context.subscriptions.push(statusItem);
}

export function deactivate(): void {}
