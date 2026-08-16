export interface OpenFileInfo {
  relativePath: string;
  dirty: boolean;
}

export interface TabLike {
  input: unknown;
}

export interface DocumentLike {
  uri: { toString(): string };
  isDirty: boolean;
}

export function buildOpenFiles(
  tabs: readonly TabLike[],
  textDocuments: readonly DocumentLike[],
  isActiveFile: (uriString: string) => boolean,
  isFileTextInput: (input: unknown) => boolean,
  asRelativePath: (uriString: string) => string,
  isFileScheme: (uriString: string) => boolean
): OpenFileInfo[] {
  const dirtyByUri = new Map(textDocuments.map((d) => [d.uri.toString(), d.isDirty]));
  const seen = new Set<string>();
  const result: OpenFileInfo[] = [];
  for (const tab of tabs) {
    if (!isFileTextInput(tab.input)) continue;
    const uriString = (tab.input as { uri: { toString(): string } }).uri.toString();
    if (!isFileScheme(uriString)) continue;
    if (seen.has(uriString)) continue;
    seen.add(uriString);
    if (isActiveFile(uriString)) continue;
    result.push({
      relativePath: asRelativePath(uriString),
      dirty: dirtyByUri.get(uriString) ?? false,
    });
  }
  return result;
}
