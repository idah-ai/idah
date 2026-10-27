import { createUploadItem, type UploadItem, type UploadItemView } from "./upload-item.types";

import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
import type { ZipFileReport } from "@/data/model/media/medias/medias-record";

// A row of the upload summary. A folder is shown like a zip: one row summing its
// files, with the files the server skipped listed under it.
export type UploadRow =
  | { kind: "file"; item: UploadItem }
  | { kind: "folder"; title: string; items: UploadItem[]; skipped: ZipFileReport[] };

const LOOSE = "Not in a folder or zip";

export function folderRow(name: string, files: PickedFile[]): UploadRow {
  return { kind: "folder", title: name, items: files.map((p) => createUploadItem(p.file, p.path)), skipped: [] };
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

// New Dataset: files outside any folder or zip, in one zip-style row.
export function looseRow(loose: PickedFile[]): UploadRow {
  return {
    kind: "folder",
    title: "Loose files",
    items: [],
    skipped: loose.map((p) => ({ filename: p.path, message: LOOSE })),
  };
}

// Items to actually upload (a "Loose files" row has none).
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
