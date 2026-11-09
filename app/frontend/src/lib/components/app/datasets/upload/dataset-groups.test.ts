// ---------------------------------------------------------------------------
// dataset-groups.test.ts — which datasets a folder/zip selection turns into
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { groupIntoDatasets } from "./dataset-groups";

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

  it("leaves loose media files out", () => {
    expect(summary(["drive_01.mp4", "photo.jpg", "batch.zip"]).datasets).toEqual([["batch", ["batch.zip"]]]);
  });

  it("marks zip datasets, and gives folder datasets the prefix their entries are named below", () => {
    const { groups } = groupIntoDatasets(["flat/1.jpg", "top.zip"].map(pick));

    expect(groups.map((g) => [g.name, g.isZip, g.root])).toEqual([
      ["flat", false, "flat/"],
      ["top", true, ""],
    ]);
  });
});
