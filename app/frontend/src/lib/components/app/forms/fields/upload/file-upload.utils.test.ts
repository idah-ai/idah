// ---------------------------------------------------------------------------
// file-upload.utils.test.ts — flattening picked/dropped files and folders
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { collectDroppedFiles, fromInputFiles, mergePickedFiles, partitionAccepted } from "./file-upload.utils";

// Minimal fakes of the browser FileSystem Entry API (webkitGetAsEntry).
function fileEntry(fullPath: string) {
  const name = fullPath.split("/").pop()!;
  return {
    isFile: true,
    isDirectory: false,
    fullPath,
    file: (resolve: (file: File) => void) => resolve(new File(["x"], name)),
  };
}

// `batchSize` mimics Chrome, which returns at most 100 entries per readEntries() call.
function dirEntry(fullPath: string, children: unknown[], batchSize = 100) {
  return {
    isFile: false,
    isDirectory: true,
    fullPath,
    createReader: () => {
      let offset = 0;
      return {
        readEntries: (resolve: (entries: unknown[]) => void) => {
          resolve(children.slice(offset, offset + batchSize));
          offset += batchSize;
        },
      };
    },
  };
}

function dropItem(entry: unknown) {
  return { kind: "file", webkitGetAsEntry: () => entry };
}

const paths = (picked: { path: string }[]) => picked.map((p) => p.path).sort();

describe("collectDroppedFiles", () => {
  it("flattens nested folders at any depth, keeping relative paths", async () => {
    const tree = dirEntry("/clip_a", [
      fileEntry("/clip_a/0001.jpg"),
      dirEntry("/clip_a/deep", [dirEntry("/clip_a/deep/er", [fileEntry("/clip_a/deep/er/0002.jpg")])]),
    ]);

    const picked = await collectDroppedFiles([dropItem(tree)]);

    expect(paths(picked)).toEqual(["clip_a/0001.jpg", "clip_a/deep/er/0002.jpg"]);
    expect(picked.find((p) => p.path === "clip_a/0001.jpg")!.file.name).toBe("0001.jpg");
  });

  it("reads every batch of a large folder, not just the first 100", async () => {
    const frames = Array.from({ length: 150 }, (_, i) => fileEntry(`/seq/${String(i).padStart(4, "0")}.jpg`));

    const picked = await collectDroppedFiles([dropItem(dirEntry("/seq", frames, 100))]);

    expect(picked).toHaveLength(150);
  });

  it("handles a mixed drop of loose files, folders and zips", async () => {
    const picked = await collectDroppedFiles([
      dropItem(fileEntry("/loose.jpg")),
      dropItem(dirEntry("/folder", [fileEntry("/folder/a.jpg")])),
      dropItem(fileEntry("/batch.zip")),
    ]);

    expect(paths(picked)).toEqual(["batch.zip", "folder/a.jpg", "loose.jpg"]);
  });
});

describe("fromInputFiles", () => {
  it("uses webkitRelativePath from a folder pick and falls back to the file name", () => {
    const inFolder = new File(["x"], "0001.jpg");
    Object.defineProperty(inFolder, "webkitRelativePath", { value: "clip_a/sub/0001.jpg" });
    const loose = new File(["x"], "loose.jpg");

    expect(paths(fromInputFiles([inFolder, loose]))).toEqual(["clip_a/sub/0001.jpg", "loose.jpg"]);
  });
});

describe("partitionAccepted", () => {
  const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()!), path });

  it("keeps accepted types and counts the rest as ignored", () => {
    const { accepted, ignored } = partitionAccepted(
      [pick("clip/a.JPG"), pick("clip/.DS_Store"), pick("clip/notes.txt"), pick("batch.zip")],
      [".zip", ".jpg"],
    );

    expect(paths(accepted)).toEqual(["batch.zip", "clip/a.JPG"]);
    expect(ignored).toBe(2);
  });

  it("accepts everything when no types are configured", () => {
    const { accepted, ignored } = partitionAccepted([pick("a.txt")], null);

    expect(accepted).toHaveLength(1);
    expect(ignored).toBe(0);
  });
});

describe("mergePickedFiles", () => {
  const pick = (path: string, lastModified = 1) => ({
    file: new File(["x"], path.split("/").pop()!, { lastModified }),
    path,
  });

  it("appends a further selection, skipping files already selected", () => {
    const merged = mergePickedFiles([pick("a.jpg")], [pick("a.jpg"), pick("b.jpg")]);

    expect(paths(merged)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("keeps same-named files from different folders apart", () => {
    const merged = mergePickedFiles([pick("clip_a/0001.jpg")], [pick("clip_b/0001.jpg")]);

    expect(merged).toHaveLength(2);
  });
});
