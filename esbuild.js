const esbuild = require("esbuild");
const { readFile, rm } = require("node:fs/promises");
const { Script } = require("node:vm");

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  external: ["vscode"],
  minify: false,
  sourcemap: true,
  logLevel: "info",
};

async function assertHookBundle() {
  const code = await readFile("dist/hook.mjs", "utf8");
  if (!code.includes('"__EDITOR_CONTEXT_REGISTRY__"')) {
    throw new Error('dist/hook.mjs 缺少占位符 "__EDITOR_CONTEXT_REGISTRY__"（带双引号）——检查 esbuild quote-style 配置');
  }
  if (!code.includes("import.meta.url")) {
    throw new Error("dist/hook.mjs 缺少 import.meta.url——isDirectRun 会失效");
  }
}

async function assertExtensionBundle() {
  const code = await readFile("dist/extension.js", "utf8");
  try {
    new Script(code);
  } catch (err) {
    throw new Error(`dist/extension.js 不是合法 CJS（可能被配置成 esm 格式）: ${err.message}`);
  }
}

async function main() {
  // dist 完全由构建生成：先清理孤儿文件，避免陈旧产物被 vsce 打进 vsix
  await rm("dist", { recursive: true, force: true });
  await esbuild.build({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    format: "cjs",
  });
  await esbuild.build({
    ...common,
    entryPoints: ["src/hook/main.ts"],
    outfile: "dist/hook.mjs",
    format: "esm",
  });
  await assertHookBundle();
  await assertExtensionBundle();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
