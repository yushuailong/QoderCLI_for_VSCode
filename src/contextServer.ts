import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import * as vscode from "vscode";
import { loadRegistry, removeWindow, saveRegistry, upsertWindow } from "./lib/windowRegistry.ts";
import { buildOpenFiles } from "./lib/openFiles.ts";
import type { EditorContext } from "./lib/formatContext.ts";

export interface RunningServer {
  windowId: string;
  port: number;
  token: string;
  dispose(): Promise<void>;
}

export async function startContextServer(context: vscode.ExtensionContext): Promise<RunningServer> {
  const registryPath = join(context.globalStorageUri.fsPath, "windows.json");
  const windowId = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("hex");
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);

  let server: Server | undefined;
  for (let attempt = 0; attempt < 2 && !server; attempt++) {
    const candidate = createServer((req, res) => handleRequest(req, res, token));
    try {
      await listen(candidate);
      server = candidate;
    } catch {
      candidate.close();
    }
  }
  if (!server) throw new Error("editor-context: 无法绑定本地端口");
  const port = (server.address() as { port: number }).port;

  const entry = {
    windowId,
    port,
    token,
    workspaceFolders,
    startedAt: Math.floor(Date.now() / 1000),
  };
  const registry = await loadRegistry(registryPath);
  await saveRegistry(registryPath, upsertWindow(registry, entry));

  // 多窗口同时激活时后保存者可能覆盖先保存者的条目（读-改-写竞态）：
  // 每次窗口重新获得焦点时重写自己的条目，实现自愈补偿
  const rewriteEntry = async (): Promise<void> => {
    const current = await loadRegistry(registryPath);
    await saveRegistry(registryPath, upsertWindow(current, entry));
  };
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) void rewriteEntry();
    })
  );

  async function dispose(): Promise<void> {
    server?.close();
    const current = await loadRegistry(registryPath);
    await saveRegistry(registryPath, removeWindow(current, windowId));
  }
  return { windowId, port, token, dispose };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse, token: string): void {
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET" || req.url !== "/context") {
    send(404, { error: "not found" });
    return;
  }
  if (req.headers["x-editor-token"] !== token) {
    send(403, { error: "forbidden" });
    return;
  }
  const ctx = buildContext();
  if (!ctx) {
    send(404, { error: "no active editor" });
    return;
  }
  send(200, ctx);
}

function buildContext(): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const { document, selection } = editor;
  if (document.uri.scheme !== "file") return undefined;
  let sel: EditorContext["selection"] = null;
  if (!selection.isEmpty) {
    sel = {
      startLine: selection.start.line + 1,
      endLine: selection.end.line + 1,
      text: document.getText(selection),
    };
  }
  const activeUriString = document.uri.toString();
  const openFiles = buildOpenFiles(
    vscode.window.tabGroups.all.flatMap((g) => g.tabs),
    vscode.workspace.textDocuments,
    (s) => s === activeUriString,
    (input) => input instanceof vscode.TabInputText,
    (s) => vscode.workspace.asRelativePath(vscode.Uri.parse(s), false),
    (s) => vscode.Uri.parse(s).scheme === "file"
  );
  return {
    file: document.uri.fsPath,
    relativePath: vscode.workspace.asRelativePath(document.uri, false),
    line: selection.active.line + 1,
    selection: sel,
    dirty: document.isDirty,
    openFiles,
  };
}
