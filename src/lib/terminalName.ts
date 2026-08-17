export const QODER_TERMINAL_BASE = "Qoder CLI";

const NUMBERED_NAME = /^Qoder CLI (?:[2-9]|\d{2,})$/;

export function isQoderTerminalName(name: string): boolean {
  return name === QODER_TERMINAL_BASE || NUMBERED_NAME.test(name);
}

export function nextQoderTerminalName(existingNames: string[]): string {
  const used = new Set(existingNames);
  if (!used.has(QODER_TERMINAL_BASE)) return QODER_TERMINAL_BASE;
  for (let n = 2; ; n++) {
    const candidate = `${QODER_TERMINAL_BASE} ${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
