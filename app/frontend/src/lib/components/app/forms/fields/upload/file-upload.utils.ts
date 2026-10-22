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

// OS-generated metadata, mirroring the backend's zip rules (Medias::UploadConstants):
// exact basenames, a __MACOSX path segment, or a "._" AppleDouble sidecar.
const SYSTEM_ARTIFACT_FILES = new Set([".DS_Store", "Thumbs.db", "ehthumbs.db", "desktop.ini"]);
const SYSTEM_ARTIFACT_DIRS = new Set(["__MACOSX"]);

function isSystemArtifact(path: string): boolean {
  const segments = path.split("/");
  const basename = segments.at(-1)!;
  return (
    SYSTEM_ARTIFACT_FILES.has(basename) ||
    basename.startsWith("._") ||
    segments.some((segment) => SYSTEM_ARTIFACT_DIRS.has(segment))
  );
}

// OS metadata is dropped silently; other unsupported files are returned as ignored.
export function partitionAccepted(
  picked: PickedFile[],
  acceptedFileTypes: string[] | null | undefined,
): { accepted: PickedFile[]; ignored: PickedFile[] } {
  const accepted: PickedFile[] = [];
  const ignored: PickedFile[] = [];
  for (const p of picked) {
    if (isSystemArtifact(p.path)) continue;
    (isFileAccepted(p.file, acceptedFileTypes) ? accepted : ignored).push(p);
  }
  return { accepted, ignored };
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
