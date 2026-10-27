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
  it("turns a folder with only files into one dataset named after it", () => {
    expect(summary(["clip_a/0001.jpg", "clip_a/0002.jpg"]).datasets).toEqual([
      ["clip_a", ["clip_a/0001.jpg", "clip_a/0002.jpg"]],
    ]);
  });

  it("splits a folder with sub-folders into one dataset per sub-folder, flattening deeper levels", () => {
    expect(summary(["batch/clip_a/1.jpg", "batch/clip_b/cam1/2.jpg", "batch/clip_b/cam2/3.jpg"]).datasets).toEqual([
      ["clip_a", ["batch/clip_a/1.jpg"]],
      ["clip_b", ["batch/clip_b/cam1/2.jpg", "batch/clip_b/cam2/3.jpg"]],
    ]);
  });

  it("puts loose files next to sub-folders into a dataset named after the parent folder", () => {
    expect(summary(["batch/clip_a/1.jpg", "batch/cover.jpg"]).datasets).toEqual([
      ["clip_a", ["batch/clip_a/1.jpg"]],
      ["batch", ["batch/cover.jpg"]],
    ]);
  });

  it("turns each zip into one dataset named after it", () => {
    expect(summary(["batch.zip", "Frames.ZIP"]).datasets).toEqual([
      ["batch", ["batch.zip"]],
      ["Frames", ["Frames.ZIP"]],
    ]);
  });

  it("leaves loose media files out", () => {
    expect(summary(["drive_01.mp4", "photo.jpg", "batch.zip"]).datasets).toEqual([["batch", ["batch.zip"]]]);
  });

  it("groups each picked folder on its own, keeping same-named sub-folders apart", () => {
    expect(summary(["a/x/1.jpg", "b/x/2.jpg", "c/3.jpg"]).datasets).toEqual([
      ["x", ["a/x/1.jpg"]],
      ["x", ["b/x/2.jpg"]],
      ["c", ["c/3.jpg"]],
    ]);
  });

  it("makes each zip directly inside a picked folder its own dataset, next to the sub-folders", () => {
    expect(summary(["batch/clip_a/1.jpg", "batch/clip_b/2.jpg", "batch/x.zip", "batch/y.zip"]).datasets).toEqual([
      ["clip_a", ["batch/clip_a/1.jpg"]],
      ["clip_b", ["batch/clip_b/2.jpg"]],
      ["x", ["batch/x.zip"]],
      ["y", ["batch/y.zip"]],
    ]);
  });

  it("splits a zip out of a folder that otherwise holds only files", () => {
    expect(summary(["flat/1.jpg", "flat/x.zip"]).datasets).toEqual([
      ["flat", ["flat/1.jpg"]],
      ["x", ["flat/x.zip"]],
    ]);
  });

  it("keeps a zip deeper inside a sub-folder as part of that sub-folder's dataset", () => {
    expect(summary(["batch/clip_a/1.jpg", "batch/clip_a/frames.zip"]).datasets).toEqual([
      ["clip_a", ["batch/clip_a/1.jpg", "batch/clip_a/frames.zip"]],
    ]);
  });

  it("marks which datasets come from a zip", () => {
    const { groups } = groupIntoDatasets(["flat/1.jpg", "flat/x.zip", "top.zip"].map(pick));

    expect(groups.map((g) => [g.name, g.isZip])).toEqual([
      ["flat", false],
      ["x", true],
      ["top", true],
    ]);
  });
});
