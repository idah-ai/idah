import { createUploadItem, entryName, type UploadItem, type UploadItemView } from "./upload-item.types";

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

// The names of the entries a row created, in creation order.
export function createdEntryNames(row: UploadRow): string[] {
  return rowItems([row]).flatMap((item) =>
    item.uploadedMedias.slice(0, item.createdEntryCount).map((media) => entryName(item, media)),
  );
}

// Items to actually upload.
export function rowItems(rows: UploadRow[]): UploadItem[] {
  return rows.flatMap((row) => (row.kind === "folder" ? row.items : [row.item]));
}

// What the server reported for one item, named so the summary says where each file was:
// a zip's own files after the zip ("extra/frames.zip › cam/1.jpg"), and a failed upload
// (the whole file or zip) by its own path.
function itemReports(item: UploadItem): { skipped: ZipFileReport[]; failed: ZipFileReport[] } {
  const inZip = (report: ZipFileReport) => ({ ...report, filename: `${item.path} › ${report.filename}` });
  const own = item.isZip ? (reports: ZipFileReport[]) => reports.map(inZip) : (reports: ZipFileReport[]) => reports;
  return {
    skipped: own(item.skippedMedias),
    failed: [
      ...(item.errorMessage ? [{ filename: item.path, message: item.errorMessage }] : []),
      ...own(item.errorMedias),
    ],
  };
}

export function rowView(row: UploadRow): UploadItemView {
  // A zip has its own row, named after it: its files keep their path in the zip.
  if (row.kind === "file") {
    const { item } = row;
    if (!item.isZip || !item.errorMessage) return item;
    return { ...item, errorMedias: [{ filename: item.path, message: item.errorMessage }, ...item.errorMedias] };
  }

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
    skippedMedias: [...row.skipped, ...items.flatMap((item) => itemReports(item).skipped)],
    errorMedias: items.flatMap((item) => itemReports(item).failed),
  };
}

// The summary once done: failed rows first, then rows with skipped files, the rest after,
// each group in selection order. A long list then shows its problems without scrolling.
export function problemsFirst(rows: UploadRow[]): UploadRow[] {
  const rank = (row: UploadRow) => {
    const view = rowView(row);
    if (view.errorMessage || view.errorMedias.length > 0) return 0;
    return view.skippedMedias.length > 0 ? 1 : 2;
  };
  return rows
    .map((row, index) => ({ row, index, rank: rank(row) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ row }) => row);
}
