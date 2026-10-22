// ---------------------------------------------------------------------------
// upload-rows.test.ts — summary rows: loose files, zips, and folders shown
// like zips (one row, with the files skipped before upload listed under it)
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

import { groupIntoDatasets } from "./dataset-groups";
import { assignIgnored, buildEntryRows, folderRow, looseRow, rowItems, rowView } from "./upload-rows";

import type { UploadItem } from "./upload-item.types";

const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()!), path });
const names = (picked: { path: string }[]) => picked.map((p) => p.path);

describe("buildEntryRows", () => {
  it("gives loose files and zips their own row, and each picked folder one row", () => {
    const rows = buildEntryRows([pick("a.jpg"), pick("clip/1.jpg"), pick("clip/sub/2.jpg"), pick("batch.zip")], []);

    expect(rows.map((r) => (r.kind === "folder" ? `${r.title} (${r.items.length})` : r.item.name))).toEqual([
      "a.jpg",
      "clip/ (2)",
      "batch.zip",
    ]);
  });

  it("lists files skipped inside a folder under that folder, by path", () => {
    const [row] = buildEntryRows([pick("clip/1.jpg")], [pick("clip/notes.txt"), pick("clip/sub/.gitkeep")]);

    expect(rowView(row).skippedMedias).toEqual([
      { filename: "clip/notes.txt", message: "File type is not supported" },
      { filename: "clip/sub/.gitkeep", message: "File type is not supported" },
    ]);
  });

  it("still shows a folder whose files were all skipped", () => {
    const rows = buildEntryRows([], [pick("docs/notes.txt")]);

    expect(rows).toHaveLength(1);
    expect(rowView(rows[0])).toMatchObject({ name: "docs/", status: "completed", uploadedMedias: [] });
    expect(rowView(rows[0]).skippedMedias).toHaveLength(1);
  });

  it("shows a skipped loose file as its own row, like a file the server rejected", () => {
    const [row] = buildEntryRows([], [pick("notes.txt")]);

    expect(rowView(row)).toMatchObject({
      name: "notes.txt",
      status: "completed",
      skippedMedias: [{ filename: "notes.txt", message: "File type is not supported" }],
    });
    expect(rowItems([row])).toEqual([]); // nothing to upload
  });
});

describe("rowView of a folder", () => {
  it("sums its files like a zip: uploaded, created, skipped and failed", () => {
    const row = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg"), pick("clip/3.jpg")], []);
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
    const row = folderRow("clip", [pick("clip/1.jpg"), pick("clip/2.jpg")], []);
    if (row.kind !== "folder") throw new Error("expected a folder row");
    row.items[0].status = "completed";

    expect(rowView(row).status).toBe("uploading");
  });
});

describe("assignIgnored", () => {
  it("puts each skipped file with the dataset it came from", () => {
    const { groups } = groupIntoDatasets([pick("batch/clip_a/1.jpg"), pick("batch/cover.jpg"), pick("flat/1.jpg")]);

    const { byGroup } = assignIgnored(groups, [
      pick("batch/clip_a/deep/notes.txt"), // inside sub-folder dataset clip_a
      pick("batch/readme.txt"), // loose in batch -> the "batch" dataset
      pick("flat/sub/x.txt"), // inside flat (a single dataset)
    ]);

    expect(names(byGroup.get("batch/clip_a/")!)).toEqual(["batch/clip_a/deep/notes.txt"]);
    expect(names(byGroup.get("batch/*")!)).toEqual(["batch/readme.txt"]);
    expect(names(byGroup.get("flat/")!)).toEqual(["flat/sub/x.txt"]);
  });

  it("gives a fully skipped folder or sub-folder its own section, named by the same rule", () => {
    const { groups } = groupIntoDatasets([pick("batch/clip_a/1.jpg")]);

    const { skippedGroups, loose } = assignIgnored(groups, [
      pick("batch/clip_z/y.txt"),
      pick("batch/clip_z/z.xml"),
      pick("junk/notes.txt"),
    ]);

    expect(skippedGroups.map((g) => [g.name, names(g.files)])).toEqual([
      ["clip_z", ["batch/clip_z/y.txt", "batch/clip_z/z.xml"]],
      ["junk", ["junk/notes.txt"]],
    ]);
    expect(loose).toEqual([]);
  });

  it("returns loose files (outside any folder) separately", () => {
    const { byGroup, skippedGroups, loose } = assignIgnored([], [pick("drive_01.mp4"), pick("notes.txt")]);

    expect(byGroup.size).toBe(0);
    expect(skippedGroups).toEqual([]);
    expect(names(loose)).toEqual(["drive_01.mp4", "notes.txt"]);
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
