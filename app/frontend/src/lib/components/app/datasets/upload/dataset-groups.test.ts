// ---------------------------------------------------------------------------
// dataset-groups.test.ts — which datasets a folder/zip selection turns into
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { DEFAULT_LOOSE_NAME, groupIntoDatasets, pickedItems } from "./dataset-groups";

const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()!), path });

// name -> sorted file paths, for readable assertions
const summary = (picked: string[]) => {
  const { groups } = groupIntoDatasets(picked.map(pick));
  return { datasets: groups.map((g) => [g.name, g.files.map((f) => f.path).sort()]) };
};

describe("groupIntoDatasets", () => {
  it("turns a folder into one dataset named after it", () => {
    expect(summary(["clip_a/0001.jpg", "clip_a/0002.jpg"]).datasets).toEqual([
      ["clip_a", ["clip_a/0001.jpg", "clip_a/0002.jpg"]],
    ]);
  });

  it("keeps sub-folders, deeper levels and zips inside a folder in that folder's dataset", () => {
    expect(
      summary(["batch/clip_a/1.jpg", "batch/clip_b/cam1/2.jpg", "batch/cover.jpg", "batch/x.zip"]).datasets,
    ).toEqual([["batch", ["batch/clip_a/1.jpg", "batch/clip_b/cam1/2.jpg", "batch/cover.jpg", "batch/x.zip"]]]);
  });

  it("turns each zip into one dataset named after it", () => {
    expect(summary(["batch.zip", "Frames.ZIP"]).datasets).toEqual([
      ["batch", ["batch.zip"]],
      ["Frames", ["Frames.ZIP"]],
    ]);
  });

  it("makes one dataset per picked folder or zip, in selection order", () => {
    expect(summary(["b/1.jpg", "top.zip", "a/x/2.jpg", "b/3.jpg"]).datasets).toEqual([
      ["b", ["b/1.jpg", "b/3.jpg"]],
      ["top", ["top.zip"]],
      ["a", ["a/x/2.jpg"]],
    ]);
  });

  it("puts the loose files together in one dataset, named by the user", () => {
    const { groups } = groupIntoDatasets(["drive_01.mp4", "batch.zip", "photo.jpg"].map(pick), {
      looseName: "  Drives ",
    });
    expect(groups.map((g) => [g.name, g.root, g.files.map((f) => f.path)])).toEqual([
      ["Drives", "", ["drive_01.mp4", "photo.jpg"]],
      ["batch", "", ["batch.zip"]],
    ]);
    expect(groupIntoDatasets(["a.jpg"].map(pick)).groups[0].name).toBe(DEFAULT_LOOSE_NAME);
  });

  it("marks zip datasets, and gives folder datasets the prefix their entries are named below", () => {
    const { groups } = groupIntoDatasets(["flat/1.jpg", "top.zip"].map(pick));

    expect(groups.map((g) => [g.name, g.isZip, g.root])).toEqual([
      ["flat", false, "flat/"],
      ["top", true, ""],
    ]);
  });

  it("splits a folder into one dataset per sub-folder, leaving out the files at its top", () => {
    const picked = ["batch/clip_10/1.jpg", "batch/clip_2/a/2.jpg", "batch/cover.jpg", "other/1.jpg"].map(pick);
    const { groups, leftOut } = groupIntoDatasets(picked, { split: new Set(["batch/"]) });

    expect(groups.map((g) => [g.name, g.root, g.files.map((f) => f.path)])).toEqual([
      ["clip_2", "batch/clip_2/", ["batch/clip_2/a/2.jpg"]], // natural order: 2 before 10
      ["clip_10", "batch/clip_10/", ["batch/clip_10/1.jpg"]],
      ["other", "other/", ["other/1.jpg"]],
    ]);
    expect(leftOut.map((l) => [l.name, l.files.map((f) => f.path)])).toEqual([["batch", ["batch/cover.jpg"]]]);
  });

  it("keeps a folder without sub-folders as one dataset even when asked to split", () => {
    const { groups } = groupIntoDatasets(["flat/1.jpg"].map(pick), { split: new Set(["flat/"]) });
    expect(groups.map((g) => g.name)).toEqual(["flat"]);
  });

  it("never splits a zip: its contents are only known server-side", () => {
    const { groups } = groupIntoDatasets(["batch.zip"].map(pick), { split: new Set(["batch.zip"]) });
    expect(groups.map((g) => [g.name, g.isZip, g.root])).toEqual([["batch", true, ""]]);
  });
});

describe("pickedItems", () => {
  it("describes each folder or zip's sub-folders and top files, and the loose files", () => {
    const items = pickedItems(["batch/b/1.jpg", "batch/a/x/2.jpg", "batch/c.jpg", "z.zip", "l.jpg"].map(pick));
    expect(items.map((i) => [i.name, i.isLoose, i.subFolders, i.topFiles])).toEqual([
      ["batch", false, ["a", "b"], 1],
      ["z", false, [], 0],
      [DEFAULT_LOOSE_NAME, true, [], 1],
    ]);
    expect(items.map((i) => i.subFolderFiles)).toEqual([{ a: 1, b: 1 }, {}, {}]);
  });
});
