import { promises as fs } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const isWindows = process.platform === "win32";

/**
 * Expand "qoder" into the candidate file names to look for in each PATH
 * directory. On Windows this mirrors `where` by appending every PATHEXT
 * extension; elsewhere it is just the literal name.
 */
export function executableCandidates(isWindows: boolean, env: NodeJS.ProcessEnv): string[] {
  if (!isWindows) return ["qoder"];
  const pathext = env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  const exts = pathext
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e !== "" && e !== ".");
  return ["qoder", ...exts.map((ext) => (ext.startsWith(".") ? `qoder${ext}` : `qoder.${ext}`))];
}

// 注：Windows 上 X_OK 等价于存在性检查（Node 语义），与 where 行为一致
async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile()) return false;
    await fs.access(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveQoderExecutable(
  configuredPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  if (configuredPath && configuredPath.trim() !== "") {
    try {
      const stat = await fs.stat(configuredPath);
      if (stat.isFile()) return configuredPath;
    } catch {}
    return undefined;
  }
  // Search PATH natively instead of spawning `which`/`where`: child_process
  // resolves the tool itself against the injected env's PATH, so a test env
  // whose PATH only contains a temp dir makes spawning `which` fail outright.
  // 空条目按未设置处理（不视为 cwd，防御性选择）
  const dirs = (env.PATH ?? "").split(delimiter).filter((d) => d !== "");
  for (const dir of dirs) {
    for (const name of executableCandidates(isWindows, env)) {
      const candidate = resolve(join(dir, name));
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  return undefined;
}
