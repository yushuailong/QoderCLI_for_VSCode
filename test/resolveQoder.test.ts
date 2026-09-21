import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("未配置时从 PATH 查找 qoder 回退名", skipOnWindows, async () => {
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

test("未配置时从 PATH 查找 qodercli", skipOnWindows, async () => {
  const dir = await mkdtemp(join(tmpdir(), "qoder-"));
  try {
    const bin = join(dir, "qodercli");
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

test("qodercli 优先于更靠前 PATH 目录中的 qoder 分发器", skipOnWindows, async () => {
  const dir1 = await mkdtemp(join(tmpdir(), "qoder-dispatch-"));
  const dir2 = await mkdtemp(join(tmpdir(), "qoder-cli-"));
  try {
    const dispatcher = join(dir1, "qoder");
    await writeFile(dispatcher, "#!/bin/sh\n", "utf8");
    await chmod(dispatcher, 0o755);
    const cli = join(dir2, "qodercli");
    await writeFile(cli, "#!/bin/sh\n", "utf8");
    await chmod(cli, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: [dir1, dir2].join(":"),
    });
    assert.equal(found, cli);
  } finally {
    await rm(dir1, { recursive: true, force: true });
    await rm(dir2, { recursive: true, force: true });
  }
});

test("PATH 中也没有且回退位置为空: 返回 undefined", skipOnWindows, async () => {
  const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
  const emptyHome = await mkdtemp(join(tmpdir(), "empty-home-"));
  try {
    assert.equal(
      await resolveQoderExecutable(undefined, {
        ...process.env,
        PATH: emptyDir,
        HOME: emptyHome,
      }),
      undefined
    );
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
    await rm(emptyHome, { recursive: true, force: true });
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

test("PATH 前部命中远程 server 的 remote-cli shim 时跳过，继续找真实 qoder", skipOnWindows, async () => {
  const root = await mkdtemp(join(tmpdir(), "qoder-shim-"));
  const shimDir = join(root, ".qoder-server", "bin", "e7b4", "bin", "remote-cli");
  const realDir = join(root, "entry");
  try {
    await mkdir(shimDir, { recursive: true });
    await mkdir(realDir, { recursive: true });
    const shim = join(shimDir, "qoder");
    const real = join(realDir, "qoder");
    await writeFile(shim, "#!/bin/sh\n", "utf8");
    await chmod(shim, 0o755);
    await writeFile(real, "#!/bin/sh\n", "utf8");
    await chmod(real, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: [shimDir, realDir].join(":"),
    });
    assert.equal(found, real);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PATH 中只有 remote-cli shim 且默认位置为空: 返回 undefined 而非 shim", skipOnWindows, async () => {
  const root = await mkdtemp(join(tmpdir(), "qoder-shimonly-"));
  const shimDir = join(root, ".vscode-server", "bin", "abc", "bin", "remote-cli");
  const emptyHome = await mkdtemp(join(tmpdir(), "empty-home-"));
  try {
    await mkdir(shimDir, { recursive: true });
    for (const name of ["qoder", "qodercli"]) {
      const shim = join(shimDir, name);
      await writeFile(shim, "#!/bin/sh\n", "utf8");
      await chmod(shim, 0o755);
    }
    assert.equal(
      await resolveQoderExecutable(undefined, {
        ...process.env,
        PATH: shimDir,
        HOME: emptyHome,
      }),
      undefined
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(emptyHome, { recursive: true, force: true });
  }
});

test("PATH 只有 remote-cli shim 时回退到 HOME 下的真实 CLI（远程场景）", skipOnWindows, async () => {
  const root = await mkdtemp(join(tmpdir(), "qoder-shimhome-"));
  const shimDir = join(root, ".qoder-server", "bin", "e7b4", "bin", "remote-cli");
  const home = await mkdtemp(join(tmpdir(), "fake-home-"));
  try {
    await mkdir(shimDir, { recursive: true });
    const shim = join(shimDir, "qoder");
    await writeFile(shim, "#!/bin/sh\n", "utf8");
    await chmod(shim, 0o755);
    const cli = join(home, ".local", "bin", "qodercli");
    await mkdir(join(home, ".local", "bin"), { recursive: true });
    await writeFile(cli, "#!/bin/sh\n", "utf8");
    await chmod(cli, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: shimDir,
      HOME: home,
    });
    assert.equal(found, cli);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("PATH 找不到时回退到默认安装位置 ~/.local/bin/qodercli", async () => {
  const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
  const home = await mkdtemp(join(tmpdir(), "fake-home-"));
  try {
    const cli = join(home, ".local", "bin", "qodercli");
    await mkdir(join(home, ".local", "bin"), { recursive: true });
    await writeFile(cli, "#!/bin/sh\n", "utf8");
    await chmod(cli, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: emptyDir,
      HOME: home,
    });
    assert.equal(found, cli);
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("回退链: ~/.local/bin 与 ~/.qoder/bin 缺失时用 ~/.qoder/entry/qoder", async () => {
  const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
  const home = await mkdtemp(join(tmpdir(), "fake-home-"));
  try {
    const dispatcher = join(home, ".qoder", "entry", "qoder");
    await mkdir(join(home, ".qoder", "entry"), { recursive: true });
    await writeFile(dispatcher, "#!/bin/sh\n", "utf8");
    await chmod(dispatcher, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: emptyDir,
      HOME: home,
    });
    assert.equal(found, dispatcher);
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("PATH 命中优先于默认安装位置", async () => {
  const binDir = await mkdtemp(join(tmpdir(), "pathbin-"));
  const home = await mkdtemp(join(tmpdir(), "fake-home-"));
  try {
    const onPath = join(binDir, "qodercli");
    await writeFile(onPath, "#!/bin/sh\n", "utf8");
    await chmod(onPath, 0o755);
    const fallback = join(home, ".local", "bin", "qodercli");
    await mkdir(join(home, ".local", "bin"), { recursive: true });
    await writeFile(fallback, "#!/bin/sh\n", "utf8");
    await chmod(fallback, 0o755);
    const found = await resolveQoderExecutable(undefined, {
      ...process.env,
      PATH: binDir,
      HOME: home,
    });
    assert.equal(found, onPath);
  } finally {
    await rm(binDir, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("executableCandidates: Windows 按 PATHEXT 展开候选", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".COM;.EXE" }),
    ["qodercli", "qodercli.COM", "qodercli.EXE", "qoder", "qoder.COM", "qoder.EXE"]
  );
});

test("executableCandidates: PATHEXT 条目无点前缀时补点", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: "EXE;.BAT" }),
    ["qodercli", "qodercli.EXE", "qodercli.BAT", "qoder", "qoder.EXE", "qoder.BAT"]
  );
});

test("executableCandidates: posix 只返回裸名且 qodercli 优先", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(executableCandidates(false, {}), ["qodercli", "qoder"]);
});

test("executableCandidates: PATHEXT 空/点/空白条目被过滤", async () => {
  const { executableCandidates } = await import("../src/lib/resolveQoder.ts");
  assert.deepEqual(
    executableCandidates(true, { PATHEXT: ".EXE;;.;  ;.BAT" }),
    ["qodercli", "qodercli.EXE", "qodercli.BAT", "qoder", "qoder.EXE", "qoder.BAT"]
  );
});
