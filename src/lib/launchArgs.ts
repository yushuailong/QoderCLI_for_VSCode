export interface QoderLaunchOptions {
  injectEditorContext: boolean;
  launchArgs: string[];
  settingsPath?: string;
  hookPath?: string;
}

/* 返回 undefined 表示自动注入被要求但 settings 部署失败, 调用方应告警并中止启动 */
export function buildQoderLaunchArgs(
  options: QoderLaunchOptions
): string[] | undefined {
  const userArgs = options.launchArgs.map((arg) => expandVariables(arg, options));
  if (!options.injectEditorContext) return userArgs;
  if (options.settingsPath === undefined) return undefined;
  return ["--settings", options.settingsPath, ...userArgs];
}

/* settings.json 手写非法值(非数组/非字符串元素)时过滤, 避免后续 map 抛错 */
export function sanitizeLaunchArgs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((arg): arg is string => typeof arg === "string");
}

function expandVariables(arg: string, options: QoderLaunchOptions): string {
  return arg
    .replaceAll("${settingsPath}", options.settingsPath ?? "")
    .replaceAll("${hookPath}", options.hookPath ?? "");
}
