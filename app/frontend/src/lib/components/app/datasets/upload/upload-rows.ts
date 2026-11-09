import { createUploadItem, type UploadItem, type UploadItemView } from "./upload-item.types";

import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
import type { ZipFileReport } from "@/data/model/media/medias/medias-record";

// A row of the upload summary. A folder is shown like a zip: one row summing its
// files, with the files the server skipped listed under it.
export type UploadRow =
  | { kind: "file"; item: UploadItem }
  | { kind: "folder"; title: string; items: UploadItem[]; skipped: ZipFileReport[] };

// Each file's path is kept relative to `root` (the dataset's folder), and names its entry:
// "batch/clip_b/cam1/0001.jpg" in dataset "clip_b" becomes "cam1/0001.jpg".
export function folderRow(name: string, files: PickedFile[], root = ""): UploadRow {
  const relative = (path: string) => (path.startsWith(root) ? path.slice(root.length) : path);
  return {
    kind: "folder",
    title: name,
    items: files.map((p) => {
      const item = createUploadItem(p.file, relative(p.path));
      if (item.isZip) item.zipPrefix = `${item.path.replace(/\.zip$/i, "")}/`; // entries keep where the zip sat
      return item;
    }),
    skipped: [],
  };
}

// Add Entry: loose files and zips get their own row, each picked folder one row.
export function buildEntryRows(picked: PickedFile[]): UploadRow[] {
  const rows: UploadRow[] = [];
  const folders = new Map<string, PickedFile[]>();

  for (const p of picked) {
    if (!p.path.includes("/")) {
      rows.push({ kind: "file", item: createUploadItem(p.file, p.path) });
      continue;
    }
    const name = p.path.split("/")[0];
    if (!folders.has(name)) {
      folders.set(name, []);
      rows.push({ kind: "folder", title: name, items: [], skipped: [] }); // placeholder keeps selection order
    }
    folders.get(name)!.push(p);
  }

  return rows.map((row) => (row.kind === "file" ? row : folderRow(row.title, folders.get(row.title)!)));
}

// Files not uploaded at all, listed as skipped in a zip-style row (nothing to upload).
export function skippedRow(title: string, files: PickedFile[], message: string): UploadRow {
  return { kind: "folder", title, items: [], skipped: files.map((p) => ({ filename: p.path, message })) };
}

// Items to actually upload.
export function rowItems(rows: UploadRow[]): UploadItem[] {
  return rows.flatMap((row) => (row.kind === "folder" ? row.items : [row.item]));
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
