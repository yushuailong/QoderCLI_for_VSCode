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
    "Qoder CLI Editor Context: qoder executable not found. Please configure qoder.executablePath in settings."
  );
}

function warnSettingsDeployFailed(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: context feature deployment failed (possibly a disk/permission issue); this terminal cannot inject editor context. Try Reload Window or reinstalling the extension."
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
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((terminal) => {
      if (terminal.name === TERMINAL_NAME) terminal.show();
    })
  );
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
