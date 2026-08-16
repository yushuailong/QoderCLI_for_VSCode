import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export interface WindowEntry {
  windowId: string;
  port: number;
  token: string;
  workspaceFolders: string[];
  startedAt: number;
}

export interface Registry {
  windows: WindowEntry[];
}

export async function loadRegistry(filePath: string): Promise<Registry> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isRegistry(parsed)) return parsed;
    // 容错读：任何读取/解析失败都按空注册表处理（设计约定：hook 侧静默降级）
  } catch {}
  return { windows: [] };
}

export async function saveRegistry(filePath: string, registry: Registry): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  const tmp = join(dirname(filePath), `.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2));
  await fs.rename(tmp, filePath);
}

export function upsertWindow(registry: Registry, entry: WindowEntry): Registry {
  return {
    windows: [...registry.windows.filter((w) => w.windowId !== entry.windowId), entry],
  };
}

export function removeWindow(registry: Registry, windowId: string): Registry {
  return { windows: registry.windows.filter((w) => w.windowId !== windowId) };
}

export function findWindowsForCwd(registry: Registry, cwd: string): WindowEntry[] {
  return registry.windows
    .filter((w) => w.workspaceFolders.some((folder) => isCwdInside(cwd, folder)))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function findWindowForCwd(registry: Registry, cwd: string): WindowEntry | undefined {
  return findWindowsForCwd(registry, cwd)[0];
}

function isCwdInside(cwd: string, folder: string): boolean {
  const c = toPosix(cwd);
  const f = toPosix(folder);
  if (isWindowsStyle(c) || isWindowsStyle(f)) {
    const lc = c.toLowerCase();
    const lf = f.toLowerCase();
    return lc === lf || lc.startsWith(lf.endsWith("/") ? lf : lf + "/");
  }
  return c === f || c.startsWith(f.endsWith("/") ? f : f + "/");
}

function isWindowsStyle(p: string): boolean {
  return /^[A-Za-z]:/.test(p) || p.startsWith("//");
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function isRegistry(value: unknown): value is Registry {
  if (typeof value !== "object" || value === null) return false;
  const windows = (value as { windows?: unknown }).windows;
  return Array.isArray(windows) && windows.every(isWindowEntry);
}

function isWindowEntry(value: unknown): value is WindowEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.windowId === "string" &&
    typeof e.port === "number" &&
    typeof e.token === "string" &&
    Array.isArray(e.workspaceFolders) &&
    e.workspaceFolders.every((f) => typeof f === "string") &&
    typeof e.startedAt === "number"
  );
}
