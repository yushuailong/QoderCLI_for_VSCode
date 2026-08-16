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
