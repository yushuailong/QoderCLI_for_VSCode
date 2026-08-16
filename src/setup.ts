import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface DeployedFiles {
  hookPath: string;
  settingsPath: string;
}

export async function deployFiles(
  storageDir: string,
  hookSourcePath: string,
  registryPath: string,
  version: string
): Promise<DeployedFiles> {
  const hookPath = join(storageDir, "hook.mjs");
  const settingsPath = join(storageDir, "qoder-settings.json");
  const versionPath = join(storageDir, "deploy-version.txt");

  const current = await fs.readFile(versionPath, "utf8").catch(() => "");
  const upToDate =
    current.trim() === version &&
    (await fileExists(hookPath)) &&
    (await fileExists(settingsPath));

  if (!upToDate) {
    const hookSource = await fs.readFile(hookSourcePath, "utf8");
    // 占位符契约：hook 源码中占位符永远以带双引号形式 "__EDITOR_CONTEXT_REGISTRY__"
    // 出现，部署时以 JSON.stringify(registryPath) 整体替换（转义 Windows 反斜杠等，
    // 函数形式同时消除 $& 等替换模式注入）
    const hookContent = hookSource.replaceAll(
      `"__EDITOR_CONTEXT_REGISTRY__"`,
      () => JSON.stringify(registryPath)
    );
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(hookPath, hookContent);
    await fs.writeFile(settingsPath, JSON.stringify(buildQoderSettings(hookPath), null, 2));
    await fs.writeFile(versionPath, version + "\n");
  }
  return { hookPath, settingsPath };
}

function buildQoderSettings(hookPath: string): unknown {
  return {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: `node "${hookPath}"`, timeout: 5 }],
        },
      ],
    },
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
