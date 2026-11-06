// ---------------------------------------------------------------------------
// idb-driver.test.ts — tombstone handling in the IndexedDB annotations driver
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { IdbBackedAnnotationsDriverAdapter, type ICrudDriver } from "./idb-driver";
import type { IAnnotationRecord } from "../../types";

// fake-indexeddb provides an in-memory IndexedDB implementation.
(globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
(globalThis as Record<string, unknown>).IDBKeyRange = IDBKeyRange;

const PLUGIN_ID = "idah-video";
const ENTRY_ID = "entry-1";

function makeRecord(overrides: Partial<IAnnotationRecord> = {}): IAnnotationRecord {
  return {
    id: "ann-1",
    shape_type: "idah-video:bounding-box",
    shape_args: { start: 1, end: 10 },
    category: "vehicles/car",
    properties: {},
    metadata: {},
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

function makeBackend(overrides: Partial<ICrudDriver<IAnnotationRecord>> = {}): ICrudDriver<IAnnotationRecord> {
  return {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue(makeRecord()),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(makeRecord()),
    setShape: vi.fn().mockResolvedValue(undefined),
    setShapes: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ICrudDriver<IAnnotationRecord>;
}

/** A driver whose sync loop is pre-seeded so fetch() does not hit the backend. The
 *  production enqueue observes op rejections (driver/index.ts #enqueue), so the
 *  mock enqueue should too when a test rejects a backend op. */
async function makeSeededDriver(
  records: IAnnotationRecord[],
  enqueue: (op: Promise<unknown>) => void = () => {},
) {
  const backend = makeBackend();
  const driver = IdbBackedAnnotationsDriverAdapter<IAnnotationRecord["shape_args"], IAnnotationRecord["properties"]>({
    entryId: ENTRY_ID,
    pluginId: PLUGIN_ID,
    backend,
    enqueue,
  });
  if (!driver) throw new Error("driver is null");

  // Seed the store directly through a fetch() that returns the records, so the
  // sync loop upserts them exactly once.
  vi.mocked(backend.list).mockResolvedValueOnce({ data: records });
  await driver.fetch();
  return { driver, backend };
}

describe("IdbBackedAnnotationsDriverAdapter tombstones", () => {
  beforeEach(() => {
    // Fresh database per test.
    indexedDB.deleteDatabase(`idahPlugin::${PLUGIN_ID}`);
  });

  afterEach(() => {
    indexedDB.deleteDatabase(`idahPlugin::${PLUGIN_ID}`);
  });

  it("sync keeps tombstones in the cache", async () => {
    const live = makeRecord({ id: "live-1" });
    const tomb = makeRecord({ id: "tomb-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([live, tomb]);

    const all = await driver.fetch({ deleted: "all" });
    expect(all.map((a) => a.id).sort()).toEqual(["live-1", "tomb-1"]);
  });

  it("fetch hides tombstones by default", async () => {
    const live = makeRecord({ id: "live-1" });
    const tomb = makeRecord({ id: "tomb-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([live, tomb]);

    const liveOnly = await driver.fetch();
    expect(liveOnly.map((a) => a.id)).toEqual(["live-1"]);
  });

  it('fetch returns only tombstones with deleted: "true"', async () => {
    const live = makeRecord({ id: "live-1" });
    const tomb = makeRecord({ id: "tomb-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([live, tomb]);

    const tombstones = await driver.fetch({ deleted: "true" });
    expect(tombstones.map((a) => a.id)).toEqual(["tomb-1"]);
  });

  it('fetch returns everything with deleted: "all"', async () => {
    const live = makeRecord({ id: "live-1" });
    const tomb = makeRecord({ id: "tomb-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([live, tomb]);

    const all = await driver.fetch({ deleted: "all" });
    expect(all.map((a) => a.id).sort()).toEqual(["live-1", "tomb-1"]);
  });

  it("delete marks the local record as a tombstone instead of removing it", async () => {
    const { driver, backend } = await makeSeededDriver([makeRecord()]);
    await driver.delete("ann-1");

    // The record is still in the cache, now as a tombstone.
    const all = await driver.fetch({ deleted: "all" });
    expect(all).toHaveLength(1);
    expect(all[0].deleted_at).toBeInstanceOf(Date);
    expect(backend.delete).toHaveBeenCalledWith("ann-1");
  });

  it("restore clears the tombstone locally first, then enqueues the backend restore", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver, backend } = await makeSeededDriver([tomb]);

    const result = await driver.restore("ann-1");
    expect(result).toBeUndefined(); // fire-and-forget, like the other writes
    expect(backend.restore).toHaveBeenCalledWith("ann-1");

    // The local tombstone is cleared immediately.
    const all = await driver.fetch({ deleted: "all" });
    expect(all[0].deleted_at).toBeNull();
  });

  it("restore keeps the local record restored when the backend fails (onSyncError handles it)", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    // Observe the enqueued op's rejection the way the production enqueue does.
    const { driver, backend } = await makeSeededDriver([tomb], (op) => {
      op.catch(() => {});
    });
    vi.mocked(backend.restore).mockRejectedValue(new Error("offline"));

    await driver.restore("ann-1"); // does not reject: the op is enqueued
    expect(backend.restore).toHaveBeenCalledWith("ann-1");

    // The local record stays restored; the failure surfaces via onSyncError.
    const all = await driver.fetch({ deleted: "all" });
    expect(all[0].deleted_at).toBeNull();
  });

  it("update refuses a tombstone", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([tomb]);

    await expect(driver.update("ann-1", { category: "dog" })).rejects.toThrow(/deleted annotation/);
  });

  it("setShape refuses a tombstone", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([tomb]);

    await expect(driver.setShape("ann-1", "tile-0x0", { rle: "A" })).rejects.toThrow(/deleted annotation/);
  });

  it("setShapes refuses a tombstone", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([tomb]);

    await expect(driver.setShapes("ann-1", [{ key: "tile-0x0", value: { rle: "A" } }])).rejects.toThrow(
      /deleted annotation/,
    );
  });

  it("create over an existing tombstone id throws a clear error", async () => {
    const tomb = makeRecord({ id: "ann-1", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const { driver } = await makeSeededDriver([tomb]);

    await expect(driver.create(makeRecord({ id: "ann-1" }))).rejects.toThrow(/already exists/);
  });
});

describe("IdbBackedAnnotationsDriverAdapter sync sharing", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase(`idahPlugin::${PLUGIN_ID}`);
  });

  afterEach(() => {
    indexedDB.deleteDatabase(`idahPlugin::${PLUGIN_ID}`);
  });

  it("two concurrent fetch() calls run the backend listing once per page", async () => {
    const backend = makeBackend();
    const driver = IdbBackedAnnotationsDriverAdapter<IAnnotationRecord["shape_args"], IAnnotationRecord["properties"]>({
      entryId: ENTRY_ID,
      pluginId: PLUGIN_ID,
      backend,
      enqueue: () => {},
    });
    if (!driver) throw new Error("driver is null");

    vi.mocked(backend.list).mockResolvedValueOnce({ data: [makeRecord({ id: "a" })] });

    await Promise.all([driver.fetch(), driver.fetch()]);

    // One shared sync loop: a single list call, not one per concurrent fetch.
    expect(backend.list).toHaveBeenCalledTimes(1);
  });

  it("a failed sync can be retried by a later fetch()", async () => {
    const backend = makeBackend();
    const driver = IdbBackedAnnotationsDriverAdapter<IAnnotationRecord["shape_args"], IAnnotationRecord["properties"]>({
      entryId: ENTRY_ID,
      pluginId: PLUGIN_ID,
      backend,
      enqueue: () => {},
    });
    if (!driver) throw new Error("driver is null");

    vi.mocked(backend.list).mockRejectedValueOnce(new Error("offline"));
    await expect(driver.fetch()).rejects.toThrow(/offline/);

    // A later fetch retries the sync and succeeds.
    vi.mocked(backend.list).mockResolvedValueOnce({ data: [makeRecord()] });
    const all = await driver.fetch();
    expect(all.map((a) => a.id)).toEqual(["ann-1"]);
    expect(backend.list).toHaveBeenCalledTimes(2);
  });
});
