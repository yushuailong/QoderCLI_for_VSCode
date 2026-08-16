export interface EditorContext {
  file: string;
  relativePath: string;
  line: number;
  selection: { startLine: number; endLine: number; text: string } | null;
  dirty: boolean;
  openFiles: { relativePath: string; dirty: boolean }[];
}

const MAX_SELECTION_CHARS = 2000;
const MAX_OPEN_FILES = 15;
const ATTRIBUTION = "Editor context injected by QoderCLI ContextBridge";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx", ".mjs": "js", ".cjs": "js",
  ".py": "python", ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
  ".rb": "ruby", ".php": "php", ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp",
  ".cc": "cpp", ".cs": "csharp", ".swift": "swift", ".sh": "bash", ".zsh": "bash",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".ini": "ini",
  ".md": "markdown", ".sql": "sql", ".css": "css", ".scss": "scss", ".less": "less",
  ".html": "html", ".xml": "xml", ".vue": "vue", ".svelte": "svelte",
};

export function formatContext(ctx: EditorContext): string {
  const lines: string[] = [`[${ATTRIBUTION}]`];
  const saveState = ctx.dirty ? " (unsaved)" : "";
  const sel = ctx.selection;
  const active = `Active: ${ctx.relativePath}${saveState} — cursor L${ctx.line}`;
  const open = (ctx.openFiles ?? []).filter((f) => f.relativePath !== ctx.relativePath);
  if (sel) {
    let text = sel.text;
    let note = "";
    if (text.length > MAX_SELECTION_CHARS) {
      text = text.slice(0, MAX_SELECTION_CHARS);
      // 截断可能把代理对（如 emoji）切半：去掉尾部孤立的高代理项
      if ((text.charCodeAt(text.length - 1) & 0xfc00) === 0xd800) {
        text = text.slice(0, -1);
      }
      note = `\n…(selection truncated to ${MAX_SELECTION_CHARS} characters)`;
    }
    const fence = fenceFor(text);
    lines.push(`${active}, selection L${sel.startLine}-L${sel.endLine}:`);
    lines.push(fence + languageFor(ctx.file));
    lines.push(text + note);
    lines.push(fence);
  } else {
    lines.push(active);
  }
  if (open.length > 0) {
    const shown = open.slice(0, MAX_OPEN_FILES);
    const entries = shown.map((f) => f.relativePath + (f.dirty ? " (unsaved)" : ""));
    if (open.length > MAX_OPEN_FILES) entries.push(`… and ${open.length - MAX_OPEN_FILES} more`);
    lines.push(`Open files (${shown.length}): ${entries.join(", ")}`);
  }
  return lines.join("\n");
}

function fenceFor(text: string): string {
  let longest = 0;
  for (const m of text.matchAll(/`+/g)) {
    longest = Math.max(longest, m[0].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

function languageFor(file: string): string {
  const dot = file.lastIndexOf(".");
  if (dot === -1) return "";
  return LANGUAGE_BY_EXTENSION[file.slice(dot).toLowerCase()] ?? "";
}
