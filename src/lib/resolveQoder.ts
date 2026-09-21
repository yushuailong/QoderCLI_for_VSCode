import { promises as fs } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const isWindows = process.platform === "win32";

// Windows 上按 PATHEXT 为候选补全扩展名；posix 原样返回
function expandWindowsExtensions(
  isWindows: boolean,
  env: NodeJS.ProcessEnv,
  bases: string[]
): string[] {
  if (!isWindows) return bases;
  const exts = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e !== "" && e !== ".");
  return bases.flatMap((base) => [
    base,
    ...exts.map((ext) => (ext.startsWith(".") ? `${base}${ext}` : `${base}.${ext}`)),
  ]);
}

/**
 * CLI 可执行文件名候选。`qodercli` 是 CLI 的正式安装名（~/.local/bin/qodercli），
 * 优先匹配；`qoder` 是 qodercli 安装的命令分发器（~/.qoder/entry/qoder，把调用
 * 路由到 CLI 或 IDE），作为回退。
 * On Windows this mirrors `where` by appending every PATHEXT extension.
 */
export function executableCandidates(isWindows: boolean, env: NodeJS.ProcessEnv): string[] {
  return expandWindowsExtensions(isWindows, env, ["qodercli", "qoder"]);
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

// 远程开发（Remote-SSH 等）会把 <home>/.vscode-server、.qoder-server 等
// 目录下的 bin/remote-cli/qoder 前置到 PATH；那是转发回客户端的 CLI shim
// （同 code CLI），用它启动会话会闪退并可能触发客户端开新窗口，必须跳过。
function isRemoteCliShim(path: string): boolean {
  const segments = path.split(/[\\/]+/);
  return segments.includes("remote-cli") && segments.some((s) => s.endsWith("-server"));
}

/**
 * PATH 之外的默认安装位置（qodercli 官方安装器布局，优先级从高到低，
 * 与 qoder 分发器 _find_cli 的回退链一致）。GUI 方式启动的 VS Code 不加载
 * shell 配置，扩展宿主的 PATH 里往往没有这些目录，因此在 PATH 搜索失败后
 * 按绝对路径兜底，保证零配置可用。
 */
export function wellKnownCandidates(isWindows: boolean, env: NodeJS.ProcessEnv): string[] {
  const home = env.HOME ?? env.USERPROFILE;
  if (!home) return [];
  return expandWindowsExtensions(isWindows, env, [
    join(home, ".local", "bin", "qodercli"),
    join(home, ".qoder", "bin", "qodercli", "qodercli"),
    join(home, ".qoder", "entry", "qoder"),
  ]);
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
  // 候选名在外层循环：qodercli 在所有 PATH 目录中优先于任何目录下的 qoder，
  // 避免把 IDE 启动器（如 /usr/local/bin/qoder 符号链接）当成 CLI。
  // 空条目按未设置处理（不视为 cwd，防御性选择）
  const dirs = (env.PATH ?? "").split(delimiter).filter((d) => d !== "");
  for (const name of executableCandidates(isWindows, env)) {
    for (const dir of dirs) {
      const candidate = resolve(join(dir, name));
      if (isRemoteCliShim(candidate)) continue;
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  // 兜底：默认安装位置（GUI 启动的窗口 PATH 缺失这些目录，零配置仍可找到）
  for (const candidate of wellKnownCandidates(isWindows, env)) {
    if (await isExecutableFile(candidate)) return candidate;
  }
  return undefined;
}
