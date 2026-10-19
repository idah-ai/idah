// A selected file plus its path relative to what the user picked/dropped
// ("clip_a/0001.jpg" for a file inside a folder, "0001.jpg" for a loose file).
export interface PickedFile {
  file: File;
  path: string;
}

// Structural subset of the FileSystem Entry API, so tests can pass plain fakes.
interface EntryLike {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
}
interface FileEntryLike extends EntryLike {
  file(resolve: (file: File) => void, reject?: (error: unknown) => void): void;
}
interface DirectoryEntryLike extends EntryLike {
  createReader(): {
    readEntries(resolve: (entries: EntryLike[]) => void, reject?: (error: unknown) => void): void;
  };
}
interface DropItemLike {
  kind?: string;
  webkitGetAsEntry(): unknown;
}

export function isFileAccepted(file: File, acceptedFileTypes: string[] | null | undefined): boolean {
  if (!acceptedFileTypes || acceptedFileTypes.length === 0) return true;
  return acceptedFileTypes.some((type) => {
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type.toLowerCase());
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1));
    return file.type === type;
  });
}

export function partitionAccepted(
  picked: PickedFile[],
  acceptedFileTypes: string[] | null | undefined,
): { accepted: PickedFile[]; ignored: number } {
  const accepted = picked.filter((p) => isFileAccepted(p.file, acceptedFileTypes));
  return { accepted, ignored: picked.length - accepted.length };
}

// Appends a further selection, skipping files already selected. The path (not the
// name) keeps same-named files from different folders apart.
export function mergePickedFiles(existing: PickedFile[], added: PickedFile[]): PickedFile[] {
  const keyOf = ({ file, path }: PickedFile) => `${path}|${file.size}|${file.lastModified}`;
  const existingKeys = new Set(existing.map(keyOf));
  return [...existing, ...added.filter((p) => !existingKeys.has(keyOf(p)))];
}

// Files from <input type="file">; a `webkitdirectory` pick fills webkitRelativePath.
export function fromInputFiles(files: ArrayLike<File>): PickedFile[] {
  return Array.from(files, (file) => ({ file, path: file.webkitRelativePath || file.name }));
}

// Files from a drop event, walking dropped folders recursively.
export async function collectDroppedFiles(items: ArrayLike<DropItemLike>): Promise<PickedFile[]> {
  // Entries must be grabbed synchronously: the DataTransferItemList is emptied
  // once the drop handler yields.
  const entries = Array.from(items)
    .filter((item) => item.kind === undefined || item.kind === "file")
    .map((item) => item.webkitGetAsEntry() as EntryLike | null)
    .filter((entry): entry is EntryLike => entry !== null);

  const nested = await Promise.all(entries.map(walk));
  return nested.flat();
}

async function walk(entry: EntryLike): Promise<PickedFile[]> {
  const path = entry.fullPath.replace(/^\//, "");

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileEntryLike).file(resolve, reject));
    return [{ file, path }];
  }

  if (!entry.isDirectory) return [];

  const reader = (entry as DirectoryEntryLike).createReader();
  const children: EntryLike[] = [];
  // readEntries returns results in batches (Chrome: max 100); an empty batch means done.
  for (;;) {
    const batch = await new Promise<EntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    children.push(...batch);
  }

  const nested = await Promise.all(children.map(walk));
  return nested.flat();
}
