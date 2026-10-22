import { createUploadItem, type UploadItem, type UploadItemView } from "./upload-item.types";

import { groupIntoDatasets, type DatasetGroup } from "./dataset-groups";
import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
import type { ZipFileReport } from "@/data/model/media/medias/medias-record";

// A row of the upload summary. A folder is shown like a zip: one row summing its
// files, with the files skipped before upload (unsupported, never sent) listed under it.
export type UploadRow =
  | { kind: "file"; item: UploadItem }
  | { kind: "folder"; title: string; items: UploadItem[]; skipped: ZipFileReport[] };

const UNSUPPORTED = "File type is not supported"; // same wording as the server's zip report
const LOOSE = "Not in a folder or zip";

const report = (p: PickedFile, message = UNSUPPORTED): ZipFileReport => ({ filename: p.path, message });

// A file that was never sent, shown like one the server rejected.
function skippedFileRow(p: PickedFile): UploadRow {
  const item = createUploadItem(p.file, p.path);
  item.status = "completed";
  item.skippedMedias = [report(p)];
  return { kind: "file", item };
}

export function folderRow(name: string, files: PickedFile[], ignored: PickedFile[]): UploadRow {
  return {
    kind: "folder",
    title: `${name}/`,
    items: files.map((p) => createUploadItem(p.file, p.path)),
    skipped: ignored.map((p) => report(p)),
  };
}

// Add Entry: loose files and zips get their own row, each picked folder one row.
export function buildEntryRows(picked: PickedFile[], ignored: PickedFile[]): UploadRow[] {
  const rows: UploadRow[] = [];
  const folders = new Map<string, { files: PickedFile[]; ignored: PickedFile[] }>();
  const folderOf = (p: PickedFile) => {
    const name = p.path.split("/")[0];
    if (!folders.has(name)) {
      folders.set(name, { files: [], ignored: [] });
      rows.push({ kind: "folder", title: name, items: [], skipped: [] }); // placeholder keeps selection order
    }
    return folders.get(name)!;
  };

  for (const p of picked) {
    if (p.path.includes("/")) folderOf(p).files.push(p);
    else rows.push({ kind: "file", item: createUploadItem(p.file, p.path) });
  }
  for (const p of ignored) {
    if (p.path.includes("/")) folderOf(p).ignored.push(p);
    else rows.push(skippedFileRow(p));
  }

  return rows.map((row) => {
    if (row.kind === "file") return row;
    const { files, ignored } = folders.get(row.title)!;
    return folderRow(row.title, files, ignored);
  });
}

// New Dataset: where each skipped file is reported.
// - byGroup: under the dataset it came from (by group key)
// - skippedGroups: folders/sub-folders where nothing was usable, so no dataset is planned;
//   named by the same rule as datasets, each shown as a "not created" section
// - loose: files outside any folder or zip
export function assignIgnored(
  groups: DatasetGroup[],
  ignored: PickedFile[],
): { byGroup: Map<string, PickedFile[]>; skippedGroups: DatasetGroup[]; loose: PickedFile[] } {
  const keys = new Set(groups.map((g) => g.key));
  const byGroup = new Map<string, PickedFile[]>();
  const orphans: PickedFile[] = [];
  const loose: PickedFile[] = [];

  for (const p of ignored) {
    const [folder, ...rest] = p.path.split("/");
    if (rest.length === 0) {
      loose.push(p);
      continue;
    }
    const sub = rest.length > 1 ? rest[0] : null;
    const key = [
      sub && `${folder}/${sub}/`, // a sub-folder dataset
      `${folder}/`, // the folder as one dataset
      rest.length === 1 && `${folder}/*`, // the folder's own loose files
    ].find((candidate) => candidate && keys.has(candidate));

    if (key) byGroup.set(key, [...(byGroup.get(key) ?? []), p]);
    else orphans.push(p);
  }

  return { byGroup, skippedGroups: groupIntoDatasets(orphans).groups, loose };
}

// New Dataset: files outside any folder or zip, in one zip-style row.
export function looseRow(loose: PickedFile[]): UploadRow {
  return { kind: "folder", title: "Loose files", items: [], skipped: loose.map((p) => report(p, LOOSE)) };
}

// Items to actually upload (rows of files skipped before upload have none).
export function rowItems(rows: UploadRow[]): UploadItem[] {
  return rows.flatMap((row) => (row.kind === "folder" ? row.items : row.item.status === "completed" ? [] : [row.item]));
}

export function rowView(row: UploadRow): UploadItemView {
  if (row.kind === "file") return row.item;

  const { items } = row;
  const pending = items.filter((item) => item.status !== "completed");
  return {
    uuid: row.title,
    name: row.title,
    path: row.title,
    isZip: true, // renders with the zip's "N files uploaded" label and skipped/failed dropdown
    isFolder: true,
    status: pending.length === 0 ? "completed" : "uploading",
    retryCount: 0,
    uploadedMedias: items.flatMap((item) => item.uploadedMedias),
    createdEntryCount: items.reduce((total, item) => total + item.createdEntryCount, 0),
    skippedMedias: [...row.skipped, ...items.flatMap((item) => item.skippedMedias)],
    errorMedias: items.flatMap((item) => [
      ...(item.errorMessage && !item.isZip ? [{ filename: item.path, message: item.errorMessage }] : []),
      ...item.errorMedias,
    ]),
  };
}
