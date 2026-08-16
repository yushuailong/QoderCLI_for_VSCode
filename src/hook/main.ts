import { get } from "node:http";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatContext, type EditorContext } from "../lib/formatContext.ts";
import { findWindowsForCwd, loadRegistry, type WindowEntry } from "../lib/windowRegistry.ts";

const REGISTRY_FALLBACK = "__EDITOR_CONTEXT_REGISTRY__";
const REQUEST_TIMEOUT_MS = 500;
const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function buildHookOutput(context: EditorContext): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: formatContext(context),
    },
  });
}

function isEditorContext(value: unknown): value is EditorContext {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.file === "string" &&
    typeof c.relativePath === "string" &&
    typeof c.line === "number" &&
    typeof c.dirty === "boolean" &&
    (c.selection === null ||
      (typeof c.selection === "object" &&
        c.selection !== null &&
        typeof (c.selection as Record<string, unknown>).startLine === "number" &&
        typeof (c.selection as Record<string, unknown>).endLine === "number" &&
        typeof (c.selection as Record<string, unknown>).text === "string")) &&
    (c.openFiles == null ||
      (Array.isArray(c.openFiles) &&
        c.openFiles.every(
          (f) =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as Record<string, unknown>).relativePath === "string" &&
            typeof (f as Record<string, unknown>).dirty === "boolean"
        )))
  );
}

function fetchContext(entry: WindowEntry): Promise<EditorContext> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = get(
      {
        host: "127.0.0.1",
        port: entry.port,
        path: "/context",
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "X-Editor-Token": entry.token },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (c: Buffer) => {
          received += c.length;
          if (received > MAX_RESPONSE_BYTES || Date.now() - startedAt > REQUEST_TIMEOUT_MS * 2) {
            req.destroy(new Error("response exceeds limit"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (isEditorContext(parsed)) resolve(parsed);
            else reject(new Error("invalid context shape"));
          } catch (err) {
            reject(err as Error);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export async function main(): Promise<void> {
  const registryPath = process.env.EDITOR_CONTEXT_REGISTRY ?? REGISTRY_FALLBACK;
  let cwd = process.cwd();
  try {
    const input: unknown = JSON.parse(await readStdin());
    if (typeof (input as { cwd?: unknown })?.cwd === "string" && (input as { cwd: string }).cwd) {
      cwd = (input as { cwd: string }).cwd;
    }
  } catch {}
  const candidates = findWindowsForCwd(await loadRegistry(registryPath), cwd);
  for (const entry of candidates) {
    const context = await fetchContext(entry).catch(() => undefined);
    if (context) {
      process.stdout.write(buildHookOutput(context));
      return;
    }
  }
}

async function isDirectRun(): Promise<boolean> {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    const self = await realpath(fileURLToPath(import.meta.url));
    return self === (await realpath(invoked));
  } catch {
    return false;
  }
}

if (await isDirectRun()) {
  try {
    await main();
  } catch (err) {
    if (process.env.EDITOR_CONTEXT_DEBUG) {
      process.stderr.write(`${err}\n`);
    }
  }
}
