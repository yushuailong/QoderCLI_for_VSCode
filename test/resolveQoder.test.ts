import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveQoderExecutable } from "../src/lib/resolveQoder.ts";

const skipOnWindows = { skip: process.platform === "win32" ? "posix only" : false };

test("configuredPath 指向存在的文件: 直接返回", skipOnWindows, async () => {
  const dir = await mkdtemp(join(tmpdir(), "qoder-"));
  try {
    const file = join(dir, "qoder-bin");
    await writeFile(file, "#!/bin/sh\n", "utf8");
    assert.equal(await resolveQoderExecutable(file), file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("configuredPath 不存在: 返回 undefined", async () => {
  assert.equal(await resolveQoderExecutable("/nonexistent/qoder"), undefined);
});

test("未配置时从 PATH 查找", skipOnWindows, async () => {
  const dir = await mkdtemp(join(tmpdir(), "qoder-"));
  try {
    const bin = join(dir, "qoder");
    await writeFile(bin, "#!/bin/sh\necho hi\n", "utf8");
    await chmod(bin, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: dir,
    });
    assert.equal(found, bin);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PATH 中也没有: 返回 undefined", skipOnWindows, async () => {
  const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
  try {
    assert.equal(
      await resolveQoderExecutable(undefined, { ...process.env, PATH: emptyDir }),
      undefined
    );
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
  }
});

test("PATH 前目录 qoder 无执行位时跳过并继续搜索后续目录", skipOnWindows, async () => {
  const dir1 = await mkdtemp(join(tmpdir(), "qoder-noexec-"));
  const dir2 = await mkdtemp(join(tmpdir(), "qoder-exec-"));
  try {
    await writeFile(join(dir1, "qoder"), "#!/bin/sh\n", "utf8"); // 无 +x
    const bin2 = join(dir2, "qoder");
    await writeFile(bin2, "#!/bin/sh\n", "utf8");
    await chmod(bin2, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: [dir1, dir2].join(":"),
    });
    assert.equal(found, bin2);
  } finally {
    await rm(dir1, { recursive: true, force: true });
    await rm(dir2, { recursive: true, force: true });
  }
});

test("executableCandidates: Windows 按 PATHEXT 展开候选", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".COM;.EXE" }),
    ["qoder", "qoder.COM", "qoder.EXE"]
  );
});

test("executableCandidates: PATHEXT 条目无点前缀时补点", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: "EXE;.BAT" }),
    ["qoder", "qoder.EXE", "qoder.BAT"]
  );
});

test("executableCandidates: posix 只返回裸名", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(executableCandidates(false, {}), ["qoder"]);
});

test("executableCandidates: PATHEXT 空/点/空白条目被过滤", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".EXE;;.;  ;.BAT" }),
    ["qoder", "qoder.EXE", "qoder.BAT"]
  );
});
