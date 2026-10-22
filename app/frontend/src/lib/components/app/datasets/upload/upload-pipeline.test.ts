// ---------------------------------------------------------------------------
// upload-pipeline.test.ts — upload media, then create entries in a dataset
// that may only be created once something was actually uploaded
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { upload, createEntry } = vi.hoisted(() => ({ upload: vi.fn(), createEntry: vi.fn() }));
vi.mock("@/data/model/media/medias/medias-record", () => ({ mediaBackendDataSource: { upload } }));
vi.mock("@/data/model/dataset/entries/record", () => ({ entriesBackendDataSource: { create: createEntry } }));
vi.mock("@/components/ui/toast/index.svelte", () => ({
  showToast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

import { createUploadItem } from "./upload-item.types";
import { once, uploadAll } from "./upload-pipeline";

const media = (filename: string) => ({ resource: `res-${filename}`, filename });
const uploaded = (...filenames: string[]) => ({ data: filenames.map(media) });
const item = (path: string) => createUploadItem(new File(["x"], path.split("/").pop()!));

const entryNames = () => createEntry.mock.calls.map(([body]) => body.attributes.name);
const entryDatasetIds = () => createEntry.mock.calls.map(([body]) => body.relationships.dataset.data.id);

describe("uploadAll", () => {
  beforeEach(() => {
    vi.useFakeTimers(); // retries back off with real delays
    createEntry.mockResolvedValue({});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  async function run(items: ReturnType<typeof item>[], getDatasetId: () => Promise<string>) {
    const done = uploadAll(items, { projectId: "p1", modality: "idah-image", getDatasetId });
    await vi.runAllTimersAsync();
    await done;
  }

  it("never asks for a dataset when nothing was uploaded", async () => {
    upload.mockResolvedValue({
      data: [],
      meta: { skipped: [{ filename: "a.txt", message: "File type is not supported" }] },
    });
    const getDatasetId = vi.fn();

    await run([item("a.txt"), item("empty.zip")], getDatasetId);

    expect(getDatasetId).not.toHaveBeenCalled();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("creates the dataset once, on the first upload that produced media", async () => {
    upload
      .mockResolvedValueOnce({ data: [] }) // nothing usable in the first file
      .mockResolvedValueOnce(uploaded("b.jpg"))
      .mockResolvedValueOnce(uploaded("z/1.jpg", "z/2.jpg"));
    const createDataset = vi.fn().mockResolvedValue("ds1");

    await run([item("a.txt"), item("b.jpg"), item("batch.zip")], once(createDataset));

    expect(createDataset).toHaveBeenCalledTimes(1);
    expect(entryDatasetIds()).toEqual(["ds1", "ds1", "ds1"]);
  });

  it("stops at once when the dataset cannot be created: no retry, remaining files not uploaded", async () => {
    upload.mockResolvedValue(uploaded("a.jpg"));
    const createDataset = vi
      .fn()
      .mockRejectedValue({ errors: [{ title: "Forbidden", detail: "You cannot create datasets here" }] });
    const items = [item("a.jpg"), item("b.jpg"), item("c.jpg")];

    await run(items, once(createDataset));

    expect(createDataset).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1); // b.jpg and c.jpg never sent
    expect(createEntry).not.toHaveBeenCalled();
    expect(items.map((i) => i.status)).toEqual(["completed", "completed", "completed"]);
    expect(items[0].errorMessage).toBe("You cannot create datasets here");
    expect(items[1].errorMessage).toBeTruthy();
  });

  it("names entries by file name only, even for files picked inside folders", async () => {
    upload.mockResolvedValueOnce(uploaded("0001.jpg")).mockResolvedValueOnce(uploaded("0001.jpg"));

    await run([item("clip_a/0001.jpg"), item("frames.zip")], async () => "ds1");

    expect(entryNames()).toEqual(["0001.jpg", "0001.jpg"]); // duplicates are fine
  });

  it("keeps going when one item fails every retry", async () => {
    upload
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(uploaded("ok.jpg"));
    const items = [item("bad.jpg"), item("ok.jpg")];

    await run(items, async () => "ds1");

    expect(items[0].status).toBe("completed");
    expect(items[0].errorMessage).toBeTruthy();
    expect(entryNames()).toEqual(["ok.jpg"]);
  });
});
