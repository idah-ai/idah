// ---------------------------------------------------------------------------
// upload-rows.test.ts — summary rows: loose files, zips, and folders shown
// like zips (one row summing its files, with the server's skips listed under it)
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

import {
  buildEntryRows,
  createdEntryNames,
  folderRow,
  problemsFirst,
  rowItems,
  rowView,
  skippedRow,
} from "./upload-rows";

import type { UploadItem } from "./upload-item.types";

const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()!), path });

describe("buildEntryRows", () => {
  it("gives loose files and zips their own row, and each picked folder one row", () => {
    const rows = buildEntryRows([pick("a.jpg"), pick("clip/1.jpg"), pick("clip/sub/2.jpg"), pick("batch.zip")]);

    expect(rows.map((r) => (r.kind === "folder" ? `${r.title} (${r.items.length})` : r.item.name))).toEqual([
      "a.jpg",
      "clip (2)",
      "batch.zip",
    ]);
  });
});

describe("folderRow", () => {
  it("keeps each file's path below the dataset folder, deeper levels included", () => {
    const row = folderRow(
      "clip_b",
      [pick("batch/clip_b/cam1/0001.jpg"), pick("batch/clip_b/0002.jpg")],
      "batch/clip_b/",
    );
    if (row.kind !== "folder") throw new Error("expected a folder row");

    expect(row.items.map((item) => item.path)).toEqual(["cam1/0001.jpg", "0002.jpg"]);
  });

  it("puts a zip's location before its entries, so they keep where it sat", () => {
    const row = folderRow("clip", [pick("clip/extra/frames.zip"), pick("clip/top.ZIP")], "clip/");
    if (row.kind !== "folder") throw new Error("expected a folder row");

    expect(row.items.map((item) => item.zipPrefix)).toEqual(["extra/frames/", "top/"]);
  });

  it("keeps the full picked path without a root (Add Entry)", () => {
    const row = folderRow("clip", [pick("clip/sub/1.jpg")]);
    if (row.kind !== "folder") throw new Error("expected a folder row");

    expect(row.items[0].path).toBe("clip/sub/1.jpg");
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
      name: "clip",
      isZip: true,
      status: "completed",
      createdEntryCount: 1,
      skippedMedias: [{ filename: "2.jpg", message: "File type is not supported" }],
      errorMedias: [{ filename: "clip/3.jpg", message: "Upload failed" }],
    });
    expect(rowView(row).uploadedMedias).toHaveLength(1);
  });

  it("names a zip's skipped and failed files after the zip, and a zip that failed by itself", () => {
    const row = folderRow("image", [pick("image/parent.zip"), pick("image/extra/other.zip")], "image/");
    if (row.kind !== "folder") throw new Error("expected a folder row");
    const [parent, other] = row.items;
    Object.assign(parent, {
      status: "completed",
      skippedMedias: [{ filename: "parent/inner.zip", message: "File type is not supported" }],
      errorMedias: [{ filename: "parent/broken.png", message: "Corrupt image" }],
    });
    Object.assign(other, { status: "completed", errorMessage: "Upload failed" });

    expect(rowView(row)).toMatchObject({
      skippedMedias: [{ filename: "parent.zip › parent/inner.zip", message: "File type is not supported" }],
      errorMedias: [
        { filename: "parent.zip › parent/broken.png", message: "Corrupt image" },
        { filename: "extra/other.zip", message: "Upload failed" },
      ],
    });
  });

  it("is uploading until every file is done", () => {
    const row = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg")]);
    if (row.kind !== "folder") throw new Error("expected a folder row");
    row.items[0].status = "completed";

    expect(rowView(row).status).toBe("uploading");
  });
});

describe("skippedRow", () => {
  it("reports files that were left out, with nothing to upload", () => {
    const row = skippedRow("batch", [pick("batch/cover.jpg")], "Not in a sub-folder");

    expect(rowItems([row])).toEqual([]);
    expect(rowView(row)).toMatchObject({
      name: "batch",
      status: "completed",
      skippedMedias: [{ filename: "batch/cover.jpg", message: "Not in a sub-folder" }],
    });
  });
});

describe("createdEntryNames", () => {
  const media = (filename: string) => ({ filename }) as UploadItem["uploadedMedias"][number];

  it("names the entries a folder and its nested zip created, leaving out those not created", () => {
    const row = folderRow("clip", [pick("clip/a.jpg"), pick("clip/b.jpg"), pick("clip/extra/frames.zip")], "clip/");
    if (row.kind !== "folder") throw new Error("expected a folder row");
    const [a, b, zip] = row.items;
    Object.assign(a, { uploadedMedias: [media("a.jpg")], createdEntryCount: 1 });
    Object.assign(b, { uploadedMedias: [media("b.jpg")], createdEntryCount: 0 }); // entry not created
    Object.assign(zip, { uploadedMedias: [media("1.jpg"), media("cam/2.jpg")], createdEntryCount: 2 });

    expect(createdEntryNames(row)).toEqual(["a.jpg", "extra/frames/1.jpg", "extra/frames/cam/2.jpg"]);
  });
});

describe("problemsFirst", () => {
  const fileRow = (name: string, problem?: "failed" | "skipped") => {
    const [row] = buildEntryRows([pick(name)]);
    if (row.kind !== "file") throw new Error("expected a file row");
    if (problem === "failed") row.item.errorMessage = "Upload failed";
    if (problem === "skipped") row.item.skippedMedias.push({ filename: name, message: "Unsupported file type" });
    return row;
  };
  const names = (rows: ReturnType<typeof problemsFirst>) => rows.map((row) => rowView(row).name);

  it("lists failed rows, then rows with skipped files, then the rest, keeping each group's order", () => {
    const rows = [
      fileRow("a.jpg"),
      fileRow("b.txt", "skipped"),
      fileRow("c.jpg", "failed"),
      fileRow("d.jpg"),
      fileRow("e.jpg", "failed"),
    ];

    expect(names(problemsFirst(rows))).toEqual(["c.jpg", "e.jpg", "b.txt", "a.jpg", "d.jpg"]);
    expect(names(rows)).toEqual(["a.jpg", "b.txt", "c.jpg", "d.jpg", "e.jpg"]); // a copy: the rows are left as they were
  });

  it("counts a folder with a failed file inside as failed", () => {
    const folder = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg")], "clip/");
    if (folder.kind !== "folder") throw new Error("expected a folder row");
    folder.items[1].errorMessage = "Upload failed";

    expect(names(problemsFirst([fileRow("a.jpg"), folder]))).toEqual(["clip", "a.jpg"]);
  });
});

describe("rowView of a zip", () => {
  it("keeps its files' paths in the zip, and lists the zip once when it failed", () => {
    const [row] = buildEntryRows([pick("batch.zip")]);
    if (row.kind !== "file") throw new Error("expected a file row");
    Object.assign(row.item, {
      status: "completed",
      errorMessage: "Upload failed",
      skippedMedias: [{ filename: "notes.txt", message: "File type is not supported" }],
    });

    expect(rowView(row)).toMatchObject({
      skippedMedias: [{ filename: "notes.txt", message: "File type is not supported" }],
      errorMedias: [{ filename: "batch.zip", message: "Upload failed" }],
    });
  });
});
