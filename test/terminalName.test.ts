import assert from "node:assert/strict";
import test from "node:test";
import { isQoderTerminalName, nextQoderTerminalName } from "../src/lib/terminalName.ts";

test("nextQoderTerminalName: 无占用时返回基础名", () => {
  assert.equal(nextQoderTerminalName([]), "Qoder CLI");
  assert.equal(nextQoderTerminalName(["zsh", "node"]), "Qoder CLI");
});

test("nextQoderTerminalName: 基础名被占时取最小可用编号", () => {
  assert.equal(nextQoderTerminalName(["Qoder CLI"]), "Qoder CLI 2");
  assert.equal(nextQoderTerminalName(["Qoder CLI", "Qoder CLI 2"]), "Qoder CLI 3");
});

test("nextQoderTerminalName: 编号空洞时补最小空洞", () => {
  assert.equal(nextQoderTerminalName(["Qoder CLI", "Qoder CLI 2", "Qoder CLI 4"]), "Qoder CLI 3");
});

test("nextQoderTerminalName: 不相关名称不算占用", () => {
  assert.equal(nextQoderTerminalName(["Qoder CLI extra", "Qoder CLIx"]), "Qoder CLI");
});

test("isQoderTerminalName: 基础名与编号名都识别", () => {
  assert.equal(isQoderTerminalName("Qoder CLI"), true);
  assert.equal(isQoderTerminalName("Qoder CLI 2"), true);
  assert.equal(isQoderTerminalName("Qoder CLI 12"), true);
});

test("isQoderTerminalName: 其他名称不识别", () => {
  assert.equal(isQoderTerminalName("Qoder CLIx"), false);
  assert.equal(isQoderTerminalName("Qoder CLI extra"), false);
  assert.equal(isQoderTerminalName("zsh"), false);
});
