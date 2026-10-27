// ---------------------------------------------------------------------------
// upload-rows.test.ts — summary rows: loose files, zips, and folders shown
// like zips (one row summing its files, with the server's skips listed under it)
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

import { buildEntryRows, folderRow, looseRow, rowView } from "./upload-rows";

import type { UploadItem } from "./upload-item.types";

const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()!), path });

describe("buildEntryRows", () => {
  it("gives loose files and zips their own row, and each picked folder one row", () => {
    const rows = buildEntryRows([pick("a.jpg"), pick("clip/1.jpg"), pick("clip/sub/2.jpg"), pick("batch.zip")]);

    expect(rows.map((r) => (r.kind === "folder" ? `${r.title} (${r.items.length})` : r.item.name))).toEqual([
      "a.jpg",
      "clip/ (2)",
      "batch.zip",
    ]);
  });
});

describe("rowView of a folder", () => {
  it("sums its files like a zip: uploaded, created, skipped and failed", () => {
    const row = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg"), pick("clip/3.jpg")]);
    if (row.kind !== "folder") throw new Error("expected a folder row");
    const [ok, skipped, failed] = row.items as UploadItem[];
    Object.assign(ok, { status: "completed", uploadedMedias: [{}], createdEntryCount: 1 });
    Object.assign(skipped, {
      status: "completed",
      skippedMedias: [{ filename: "2.jpg", message: "File type is not supported" }],
    });
    Object.assign(failed, { status: "completed", errorMessage: "Upload failed" });

    expect(rowView(row)).toMatchObject({
      name: "clip/",
      isZip: true,
      status: "completed",
      createdEntryCount: 1,
      skippedMedias: [{ filename: "2.jpg", message: "File type is not supported" }],
      errorMedias: [{ filename: "clip/3.jpg", message: "Upload failed" }],
    });
    expect(rowView(row).uploadedMedias).toHaveLength(1);
  });

  it("is uploading until every file is done", () => {
    const row = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg")]);
    if (row.kind !== "folder") throw new Error("expected a folder row");
    row.items[0].status = "completed";

    expect(rowView(row).status).toBe("uploading");
  });
});

describe("looseRow", () => {
  it("lists loose files with their reason", () => {
    expect(rowView(looseRow([pick("drive_01.mp4")]))).toMatchObject({
      name: "Loose files",
      status: "completed",
      skippedMedias: [{ filename: "drive_01.mp4", message: "Not in a folder or zip" }],
    });
  });
});
