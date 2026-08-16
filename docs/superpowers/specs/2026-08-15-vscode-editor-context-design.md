# QoderCLI ContextBridge（原名 vscode-editor-context）设计文档

日期：2026-08-15
状态：已与需求方逐节确认

## 1. 背景与目标

Qoder CLI（qodercli）在 VSCode 内置终端中使用时，无法感知用户当前打开的文件与选中的代码。同类能力此前仅存在于个别闭源产品的官方 VSCode 插件中，未对第三方开放。

本项目交付一个开源 VSCode 扩展，为 Qoder CLI 提供同等的编辑器上下文注入能力：

- **开箱即用**：用户只需安装一个 `.vsix`，零配置、零文件改动
- **全程无感**：每条消息发出瞬间自动附上最新的编辑器状态
- **零侵入**：不修改用户的 `~/.qoder/settings.json`，不修改任何项目文件；卸载扩展即完全消失

### 非目标（v1 不做）

- 不做 MCP 通道（可作为后续补充，复用同一 HTTP 端点）
- 不做 diff 审批、权限接管等 ACP 级别的编辑器托管能力
- 不发布到 Marketplace（先以 GitHub + `.vsix` 安装分发；发布流程后续另议）

## 2. 用户体验流程

1. 用户安装 `.vsix` 并重启 VSCode
2. 扩展自动激活（`onStartupFinished`），静默完成初始化（见 §4.3）
3. 用户点击终端面板 `+` 下拉，出现 **"Qoder CLI"** 选项
4. 点击后创建一个面板终端，扩展执行：
   `qoder --settings <globalStorage>/qoder-settings.json`
5. 用户选中代码、在终端里发消息；每次提交时 hook 实时拉取编辑器状态并注入对话

## 3. 总体架构

三个子系统，扩展与 hook 之间只通过「窗口注册文件 + 本地 HTTP 端点」通信：

| 子系统 | 模块 | 职责 |
|---|---|---|
| 上下文服务 | `src/contextServer.ts` | 在 127.0.0.1 随机端口启动 HTTP 服务；维护跨窗口注册文件；收到请求时实时读 `window.activeTextEditor` |
| 终端入口 | `src/terminalProfile.ts` | 注册 "Qoder CLI" 终端 profile；创建面板终端并带 `--settings` 启动 qoder；复用同名终端避免重复 |
| 初始化 | `src/setup.ts` | 激活时幂等地把 hook 脚本与 qoder 配置写入扩展 globalStorage（带版本号） |

架构选型（已对比确认）：**拉取式**（hook 在提交瞬间请求扩展实时状态）优于推送式（扩展监听事件写文件）——数据永远是发送那一刻的，且无需监听高频选区事件。与同类官方插件的内部架构同构。

零侵入原理：qoder 的 `--settings` 参数为最高优先级配置源，与其他来源**深度合并**（本配置只声明 `hooks.UserPromptSubmit` 一个字段，其余字段一律保留用户原值）。因此 hook 仅在扩展启动的会话中生效；用户在任意终端裸跑 `qoder` 行为不变。

## 4. 详细设计

### 4.1 仓库结构

```
/Users/yushuailong/workspace/qodercli-contextbridge/
├── src/
│   ├── extension.ts        # 入口：激活时注册各子系统
│   ├── contextServer.ts    # HTTP 服务 + 窗口注册
│   ├── terminalProfile.ts  # 终端 profile
│   ├── setup.ts            # globalStorage 初始化（部署时生成 qoder-settings.json）
│   ├── hook/
│   │   └── main.ts         # hook 脚本源码（esbuild 构建为 dist/hook.mjs，零依赖 ESM 单文件）
│   └── lib/                # 纯逻辑（窗口匹配、格式化），便于单测
├── dist/                   # dist/extension.js + dist/hook.mjs（esbuild 产物）
├── test/                   # node:test 单测与 mock 集成测试
├── .github/workflows/ci.yml
├── package.json / esbuild.js / .vscodeignore
├── README.md / LICENSE (MIT)
└── docs/superpowers/specs/…-design.md
```

扩展标识：`publisher: yushuailong`，`name: qodercli-contextbridge`（原名 `vscode-editor-context`，开源前已改名；扩展 ID 为 `yushuailong.qodercli-contextbridge`，globalStorage 目录随之变为 `yushuailong.qodercli-contextbridge`）。

### 4.2 窗口注册协议

注册文件：`<globalStorage>/windows.json`（globalStorage 为扩展专属目录，全窗口共享，卸载即消失）。

```json
{
  "windows": [
    {
      "windowId": "a1b2c3…",
      "port": 51783,
      "token": "随机 32 字节 hex",
      "workspaceFolders": ["/Users/x/projA", "/Users/x/projB"],
      "startedAt": 1755230000
    }
  ]
}
```

- 每个扩展宿主（VSCode 窗口）激活时写入自己的一条，窗口关闭（subscription dispose）时移除
- 写入采用临时文件 + rename 原子写；hook 读到损坏 JSON 视为无注册
- hook 遇到端口不通的死条目直接跳过（双保险）

### 4.3 globalStorage 文件（setup 子系统）

激活时写入两个文件，幂等，内容带版本号（版本变化则覆盖）：

**`qoder-settings.json`** —— 启动参数 `--settings` 指向它：

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node \"<globalStorage>/hook.mjs\"", "timeout": 5 }
        ]
      }
    ]
  }
}
```

**`hook.mjs`** —— esbuild 打包的 ESM 单文件产物（零依赖，用 Node 内置 `http` 模块），跨平台（Windows 无 bash/jq/curl，而 qodercli 用户必有 Node）。

占位符契约：hook 源码中的注册表路径占位符永远以带双引号形式 `"__EDITOR_CONTEXT_REGISTRY__"` 出现，部署时以 JSON.stringify(registryPath) 整体替换——JSON.stringify 会转义 Windows 反斜杠等字符，保证产物仍是合法的 JS 字符串字面量。

### 4.4 HTTP 端点

`GET /context`，必须携带 `X-Editor-Token: <token>` 头。扩展收到请求的瞬间读取 `window.activeTextEditor`：

```json
{
  "file": "/Users/x/projA/src/app.ts",
  "relativePath": "src/app.ts",
  "line": 42,
  "selection": { "startLine": 40, "endLine": 45, "text": "选中内容…" },
  "dirty": true,
  "openFiles": [
    { "relativePath": "src/lib/a.ts", "dirty": true },
    { "relativePath": "package.json", "dirty": false }
  ]
}
```

- 无选中时 `selection: null`
- 行号一律为 **1-based**（VSCode API 返回 0-based，注入前 +1），与编辑器显示及模型阅读文件时的行号一致
- 无活动文本编辑器、或编辑器 `uri.scheme !== "file"` 时返回 404
- VSCode 特性：焦点在终端打字时 `activeTextEditor` 保留最后聚焦的编辑器，「写代码 → 切终端发消息」场景拿到的正是用户刚才看的位置
- `relativePath` 相对该文件所属的工作区文件夹计算（`asRelativePath(uri, false)`；单根工作区即相对根目录；文件不在任何工作区内时返回绝对路径）
- `openFiles`：来自 `window.tabGroups.all` 中所有文本类标签页（`input instanceof TabInputText` 且 `uri.scheme === "file"`），每项含 `relativePath` 与 `dirty`（对照 `workspace.textDocuments` 判断）；活动文件包含在内，由格式化层排除；非文本标签页（diff、预览等）不进入列表

### 4.5 hook 脚本流程

```
stdin(qodercli 事件 JSON) → 取 cwd
  → 读 windows.json → 匹配 workspaceFolders 中包含 cwd 的窗口（cwd 等于该目录或位于其下；多根工作区任一命中即可）
  → 无匹配 → exit 0，无输出（不注入）
  → HTTP 请求 127.0.0.1:<port>/context（超时 500ms，带 token）
  → 成功 → stdout 输出：
      {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}
  → 任何失败 → exit 0，无输出
```

`additionalContext` 内容格式（方案 B，英文文案，含归属行与所有打开文件列表，通常几十至几百字节）：

~~~text
[Editor context injected by QoderCLI ContextBridge]
Active: src/app.ts (unsaved) — cursor L42, selection L40-L45:
```ts
…选中文本原文，截断至 2000 字符，超出时块内追加「…(selection truncated to 2000 characters)」…
```
Open files (2): src/lib/a.ts (unsaved), package.json
~~~

- 第一行为固定归属行，标明上下文由本扩展注入
- 无选区时无代码围栏，Active 行单行结束：`Active: src/app.ts — cursor L42`
- Open files 行排除活动文件，dirty 条目追加 ` (unsaved)`；超过 15 个截断为前 15 个并追加 `… and N more`；没有其他打开文件时整行省略
- hook 对 `openFiles` 字段做可选校验（容忍旧版本扩展的无该字段响应）

总耗时预算 ≤1s（HTTP 500ms 超时 + 文件读取），hook 配置层 timeout 5s 兜底，不影响发消息体感。

### 4.6 终端入口

- `package.json` 声明 `contributes.terminal.profiles`：id `qoder-cli`，标题 "Qoder CLI"
- provider 创建面板终端（`TerminalLocation.Panel`），`shellPath` 为 qoder 可执行文件，`shellArgs: ["--settings", <globalStorage>/qoder-settings.json]`，工作目录为工作区根（多根工作区取第一个文件夹；hook 按 cwd 匹配任意 folder 均可命中）
- 已存在 "Qoder CLI" 终端则 `show()` 复用，不重复创建
- qoder 路径解析：优先使用扩展设置项 `qoder.executablePath`（配置了但文件不存在则直接判定失败并提示），未配置时从 PATH 查找；都失败时弹出警告通知（showWarningMessage）提示配置 qoder.executablePath 或部署失败原因
- 状态栏按钮与快捷键 Cmd+Alt+Q / Ctrl+Shift+Q（命令 qoder-cli.openTerminal）：一键打开/复用 Qoder CLI 终端

## 5. 错误处理边界

原则：任何失败静默降级，绝不影响 qodercli 正常使用。

| 场景 | 行为 |
|---|---|
| VSCode 关闭 / 扩展未激活 / 端口不通 | hook 静默退出，不注入 |
| cwd 匹配不到任何窗口 | 不注入（严格匹配，不猜测回退） |
| 无文本编辑器 / 非文件编辑器（diff、output 面板） | 404，hook 跳过 |
| 未保存的文件 | 注入 `dirty` 标记；选中文本取自内存 document，照样有效 |
| 超大选区 | 截断 2000 字符并标注 |
| windows.json 并发写损坏 | 原子写；读失败视为空 |
| `qoder` 不在 PATH | 设置项 `qoder.executablePath`；仍失败则弹出警告通知（showWarningMessage）提示配置 qoder.executablePath 或部署失败原因 |
| 扩展升级 | 文件带版本号，激活时幂等重写 |
| 端口冲突 | 随机端口由 OS 分配；listen 失败重试一次 |

## 6. 安全考量

- HTTP 服务仅绑定 127.0.0.1，不监听外部接口
- token 存于注册文件，请求必带 `X-Editor-Token`，防本机无关进程随意探测（尽力而为级别：能读文件的本地进程仍可读取 token，与同类方案同级）
- 不执行任何用户输入，不接收写操作，端点只读

## 7. 已知限制

- 若用户自己配置过 `UserPromptSubmit` hook，在扩展启动的会话中会被本扩展的配置覆盖（数组按覆盖合并）；其他事件类型（如 Stop）因深度合并不受影响。README 中说明
- 多窗口场景严格按 cwd 匹配，匹配不上不注入（不回退到「最近活跃窗口」）
- 上下文仅注入 `UserPromptSubmit` 时机；会话中途切换编辑器，需下一条消息才会反映新状态

## 8. 测试策略

1. **纯逻辑单测**（node:test，`src/lib/`）：窗口匹配算法、additionalContext 格式化、windows.json 读写与原子性
2. **hook 集成测试**：本地 mock HTTP 服务模拟扩展端点，覆盖有/无匹配、token 错误、超时、非 JSON 响应等分支，校验 stdout 为合法 hook 输出 JSON
3. **端到端手测清单**（写入 README）：安装 vsix → 打开 Qoder CLI 终端 → 选中代码问「我在看哪里」验证回答 → 覆盖切换文件、无选区、双窗口各开各项目、关闭扩展宿主窗口、未保存文件等场景
4. **CI**（GitHub Actions）：单测 + esbuild 打包 vsix，PR 即验证

## 9. 后续方向（不在本期）

- MCP server 复用同一 HTTP 端点，作为补充通道
- 注入内容可配置（设置项选择包含哪些字段）
- 发布 VSCode Marketplace
