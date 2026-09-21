import * as vscode from "vscode";
import {
  buildQoderLaunchArgs,
  sanitizeLaunchArgs,
  type QoderLaunchOptions,
} from "./lib/launchArgs.ts";
import { resolveQoderExecutable } from "./lib/resolveQoder.ts";
import { isQoderTerminalName, nextQoderTerminalName } from "./lib/terminalName.ts";
import type { DeployedFiles } from "./setup.ts";

export const OPEN_TERMINAL_COMMAND = "qoder-cli.openTerminal";
export const OPEN_SETTINGS_FILE_COMMAND = "qoder-cli.openSettingsFile";

function nextTerminalName(): string {
  return nextQoderTerminalName(vscode.window.terminals.map((t) => t.name));
}

async function resolveQoderPath(): Promise<string | undefined> {
  const configured = vscode.workspace
    .getConfiguration("qoder")
    .get<string>("executablePath", "");
  return resolveQoderExecutable(configured.trim() === "" ? undefined : configured);
}

function warnMissingQoder(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: qodercli/qoder executable not found on PATH or in default install locations. Install Qoder CLI, or set qoder.executablePath in settings."
  );
}

function warnSettingsDeployFailed(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: context feature deployment failed (possibly a disk/permission issue); this terminal cannot inject editor context. Try Reload Window or reinstalling the extension."
  );
}

/* 每次启动时读取配置, 保证修改 launchArgs/injectEditorContext 无需重载窗口即可生效 */
function readLaunchOptions(deployed: DeployedFiles | undefined): QoderLaunchOptions {
  const config = vscode.workspace.getConfiguration("qoder");
  return {
    injectEditorContext: config.get("injectEditorContext", true),
    launchArgs: sanitizeLaunchArgs(config.get("launchArgs", [])),
    settingsPath: deployed?.settingsPath,
    hookPath: deployed?.hookPath,
  };
}

function terminalOptions(
  launchArgs: string[],
  qoderPath: string,
  name: string
): vscode.TerminalOptions {
  return {
    name,
    location: vscode.TerminalLocation.Panel,
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    shellPath: qoderPath,
    shellArgs: launchArgs,
  };
}

export function registerQoderTerminalProfile(
  context: vscode.ExtensionContext,
  deployed: DeployedFiles | undefined
): void {
  const provider: vscode.TerminalProfileProvider = {
    async provideTerminalProfile(
      _token: vscode.CancellationToken
    ): Promise<vscode.TerminalProfile | undefined> {
      const launchArgs = buildQoderLaunchArgs(readLaunchOptions(deployed));
      if (launchArgs === undefined) {
        warnSettingsDeployFailed();
        return undefined;
      }
      const qoderPath = await resolveQoderPath();
      if (!qoderPath) {
        warnMissingQoder();
        return undefined;
      }
      return new vscode.TerminalProfile(terminalOptions(launchArgs, qoderPath, nextTerminalName()));
    },
  };
  context.subscriptions.push(vscode.window.registerTerminalProfileProvider("qoder-cli", provider));
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((terminal) => {
      if (isQoderTerminalName(terminal.name)) terminal.show();
    })
  );
}

export async function openQoderTerminal(deployed: DeployedFiles | undefined): Promise<void> {
  const launchArgs = buildQoderLaunchArgs(readLaunchOptions(deployed));
  if (launchArgs === undefined) {
    warnSettingsDeployFailed();
    return;
  }
  const existing = vscode.window.terminals.filter((t) => isQoderTerminalName(t.name));
  if (existing.length > 0) {
    existing[existing.length - 1].show();
    return;
  }
  const qoderPath = await resolveQoderPath();
  if (!qoderPath) {
    warnMissingQoder();
    return;
  }
  const terminal = vscode.window.createTerminal(
    terminalOptions(launchArgs, qoderPath, nextTerminalName())
  );
  terminal.show();
}

export function openQoderSettingsFile(deployed: DeployedFiles | undefined): void {
  if (deployed?.settingsPath === undefined) {
    warnSettingsDeployFailed();
    return;
  }
  void vscode.window.showTextDocument(vscode.Uri.file(deployed.settingsPath));
}
