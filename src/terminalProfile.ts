import * as vscode from "vscode";
import { resolveQoderExecutable } from "./lib/resolveQoder.ts";
import { isQoderTerminalName, nextQoderTerminalName } from "./lib/terminalName.ts";

export const OPEN_TERMINAL_COMMAND = "qoder-cli.openTerminal";

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
    "Qoder CLI Editor Context: qoder executable not found. Please configure qoder.executablePath in settings."
  );
}

function warnSettingsDeployFailed(): void {
  vscode.window.showWarningMessage(
    "Qoder CLI Editor Context: context feature deployment failed (possibly a disk/permission issue); this terminal cannot inject editor context. Try Reload Window or reinstalling the extension."
  );
}

function terminalOptions(
  settingsPath: string,
  qoderPath: string,
  name: string
): vscode.TerminalOptions {
  return {
    name,
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
      if (settingsPath === undefined) {
        warnSettingsDeployFailed();
        return undefined;
      }
      const qoderPath = await resolveQoderPath();
      if (!qoderPath) {
        warnMissingQoder();
        return undefined;
      }
      return new vscode.TerminalProfile(terminalOptions(settingsPath, qoderPath, nextTerminalName()));
    },
  };
  context.subscriptions.push(vscode.window.registerTerminalProfileProvider("qoder-cli", provider));
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((terminal) => {
      if (isQoderTerminalName(terminal.name)) terminal.show();
    })
  );
}

export async function openQoderTerminal(settingsPath: string | undefined): Promise<void> {
  if (settingsPath === undefined) {
    warnSettingsDeployFailed();
    return;
  }
  const qoderPath = await resolveQoderPath();
  if (!qoderPath) {
    warnMissingQoder();
    return;
  }
  const terminal = vscode.window.createTerminal(
    terminalOptions(settingsPath, qoderPath, nextTerminalName())
  );
  terminal.show();
}
