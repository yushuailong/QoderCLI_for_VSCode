import assert from "node:assert/strict";
import test from "node:test";
import { buildQoderLaunchArgs, sanitizeLaunchArgs } from "../src/lib/launchArgs.ts";

const DEPLOYED = {
  settingsPath: "/globalStorage/qodercli-for-vscode/qoder-settings.json",
  hookPath: "/globalStorage/qodercli-for-vscode/hook.mjs",
};

test("默认(注入开、无追加参数): 注入 --settings 指向部署的 settings", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({ injectEditorContext: true, launchArgs: [], ...DEPLOYED }),
    ["--settings", DEPLOYED.settingsPath]
  );
});

test("追加参数: 排在自动注入的 --settings 之后, 用户可用自己的 --settings 覆盖", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: true,
      launchArgs: ["--settings", "/home/me/my-settings.json"],
      ...DEPLOYED,
    }),
    ["--settings", DEPLOYED.settingsPath, "--settings", "/home/me/my-settings.json"]
  );
});

test("注入关闭: 只保留用户参数, 不自动传 --settings", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: false,
      launchArgs: ["--verbose"],
      ...DEPLOYED,
    }),
    ["--verbose"]
  );
});

test("注入关闭且无追加参数: 返回空数组(裸启动 CLI)", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({ injectEditorContext: false, launchArgs: [], ...DEPLOYED }),
    []
  );
});

test("变量展开: ${settingsPath} 与 ${hookPath} 替换为部署路径", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: false,
      launchArgs: ["--settings", "${settingsPath}", "--hook", "${hookPath}"],
      ...DEPLOYED,
    }),
    ["--settings", DEPLOYED.settingsPath, "--hook", DEPLOYED.hookPath]
  );
});

test("未知变量: 原样保留不做替换", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: false,
      launchArgs: ["--model", "${QODER_MODEL}"],
      ...DEPLOYED,
    }),
    ["--model", "${QODER_MODEL}"]
  );
});

test("注入开但 settings 部署失败: 返回 undefined 供调用方告警并中止", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({ injectEditorContext: true, launchArgs: ["--verbose"] }),
    undefined
  );
});

test("注入开且追加参数含变量: 注入在前, 变量照常展开", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: true,
      launchArgs: ["--flag", "${hookPath}"],
      ...DEPLOYED,
    }),
    ["--settings", DEPLOYED.settingsPath, "--flag", DEPLOYED.hookPath]
  );
});

test("注入关且部署失败: 仍可裸启动, 变量展开为空字符串", () => {
  assert.deepEqual(
    buildQoderLaunchArgs({
      injectEditorContext: false,
      launchArgs: ["--settings", "${settingsPath}"],
    }),
    ["--settings", ""]
  );
});

test("sanitizeLaunchArgs: 手写非法值(字符串/null)返回空数组不抛错", () => {
  assert.deepEqual(sanitizeLaunchArgs("--verbose"), []);
  assert.deepEqual(sanitizeLaunchArgs(null), []);
  assert.deepEqual(sanitizeLaunchArgs(undefined), []);
});

test("sanitizeLaunchArgs: 数组中过滤掉非字符串元素", () => {
  assert.deepEqual(sanitizeLaunchArgs(["--verbose", 42, null, "--settings", true]), [
    "--verbose",
    "--settings",
  ]);
});

test("sanitizeLaunchArgs: 合法数组原样返回", () => {
  assert.deepEqual(sanitizeLaunchArgs(["--settings", "/a/b.json"]), ["--settings", "/a/b.json"]);
});
