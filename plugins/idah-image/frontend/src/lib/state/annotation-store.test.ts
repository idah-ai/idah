// ---------------------------------------------------------------------------
// annotation-store.test.ts — Tests for createAnnotationStore's setShape/setShapes
// rollback-on-failure behavior
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMarkOccupancyDirty } = vi.hoisted(() => ({
  mockMarkOccupancyDirty: vi.fn(),
}));

vi.mock("$lib/mask/occupancy", () => ({
  markOccupancyDirty: mockMarkOccupancyDirty,
}));

import { createAnnotationStore, type AnnotationItem } from "./data.svelte";

describe("createAnnotationStore setShape/setShapes rollback", () => {
  let driver: {
    fetch: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    setShape: ReturnType<typeof vi.fn>;
    setShapes: ReturnType<typeof vi.fn>;
  };
  let store: ReturnType<typeof createAnnotationStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = {
      fetch: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "ann-1" }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      setShape: vi.fn().mockResolvedValue(undefined),
      setShapes: vi.fn().mockResolvedValue(undefined),
    };
    store = createAnnotationStore(driver);

    // Seed the store with a mask annotation that has a tile key
    const existing: AnnotationItem = {
      id: "ann-1",
      shape: { type: "idah-image:mask", "tile-0x0": { rle: "ABC" } } as any,
      value: { category: "cat" },
    };
    // Use the internal store's upsert via the wrapper
    store.upsert(existing);
  });

  describe("setShape", () => {
    it("rolls back optimistic update on driver failure", async () => {
      driver.setShape.mockRejectedValue(new Error("Network error"));

      // The shape before the call should have tile-0x0
      expect(store.items[0].shape).toHaveProperty("tile-0x0");

      // Attempt to write a new tile — this should fail
      await expect(
        store.setShape("ann-1", "tile-0x1", { rle: "DEF" }),
      ).rejects.toThrow("Network error");

      // The shape should be restored to its original state
      expect(store.items[0].shape).toHaveProperty("tile-0x0");
      expect(store.items[0].shape).not.toHaveProperty("tile-0x1");
      expect((store.items[0].shape as any)["tile-0x0"]).toEqual({ rle: "ABC" });
    });

    it("applies optimistic update on driver success", async () => {
      driver.setShape.mockResolvedValue(undefined);

      await store.setShape("ann-1", "tile-0x1", { rle: "DEF" });

      // The new tile should be present in the local store
      expect((store.items[0].shape as any)["tile-0x1"]).toEqual({ rle: "DEF" });
      // The original tile should still be there
      expect((store.items[0].shape as any)["tile-0x0"]).toEqual({ rle: "ABC" });
    });

    it("does nothing when annotation is not found in local store", async () => {
      // setShape on a non-existent annotation should not throw
      await expect(
        store.setShape("nonexistent", "tile-0x0", { rle: "ABC" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("setShapes", () => {
    it("rolls back all optimistic updates on driver failure", async () => {
      driver.setShapes.mockRejectedValue(new Error("Network error"));

      // The shape before the call should have tile-0x0
      expect(store.items[0].shape).toHaveProperty("tile-0x0");

      // Attempt to write multiple tiles — this should fail
      await expect(
        store.setShapes("ann-1", [
          { key: "tile-0x1", value: { rle: "DEF" } },
          { key: "tile-0x2", value: { rle: "GHI" } },
        ]),
      ).rejects.toThrow("Network error");

      // The shape should be restored to its original state
      expect(store.items[0].shape).toHaveProperty("tile-0x0");
      expect(store.items[0].shape).not.toHaveProperty("tile-0x1");
      expect(store.items[0].shape).not.toHaveProperty("tile-0x2");
      expect((store.items[0].shape as any)["tile-0x0"]).toEqual({ rle: "ABC" });
    });

    it("applies all optimistic updates on driver success", async () => {
      driver.setShapes.mockResolvedValue(undefined);

      await store.setShapes("ann-1", [
        { key: "tile-0x1", value: { rle: "DEF" } },
        { key: "tile-0x2", value: { rle: "GHI" } },
      ]);

      // Both new tiles should be present in the local store
      expect((store.items[0].shape as any)["tile-0x1"]).toEqual({ rle: "DEF" });
      expect((store.items[0].shape as any)["tile-0x2"]).toEqual({ rle: "GHI" });
      // The original tile should still be there
      expect((store.items[0].shape as any)["tile-0x0"]).toEqual({ rle: "ABC" });
    });

    it("handles delete operations (null value) correctly", async () => {
      driver.setShapes.mockResolvedValue(undefined);

      // Delete the existing tile and add a new one
      await store.setShapes("ann-1", [
        { key: "tile-0x0", value: null },
        { key: "tile-0x1", value: { rle: "NEW" } },
      ]);

      // The old tile should be removed
      expect(store.items[0].shape).not.toHaveProperty("tile-0x0");
      // The new tile should be added
      expect((store.items[0].shape as any)["tile-0x1"]).toEqual({ rle: "NEW" });
    });

    it("does nothing for empty entries array", async () => {
      await store.setShapes("ann-1", []);
      expect(driver.setShapes).not.toHaveBeenCalled();
    });

    it("rolls back deletions on failure", async () => {
      driver.setShapes.mockRejectedValue(new Error("Network error"));

      await expect(
        store.setShapes("ann-1", [
          { key: "tile-0x0", value: null }, // delete the existing tile
        ]),
      ).rejects.toThrow("Network error");

      // The original tile should be restored
      expect((store.items[0].shape as any)["tile-0x0"]).toEqual({ rle: "ABC" });
    });
  });
});

describe("createAnnotationStore occupancy dirty flag", () => {
  let driver: {
    fetch: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    setShape: ReturnType<typeof vi.fn>;
    setShapes: ReturnType<typeof vi.fn>;
  };
  let store: ReturnType<typeof createAnnotationStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = {
      fetch: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "ann-1" }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      setShape: vi.fn().mockResolvedValue(undefined),
      setShapes: vi.fn().mockResolvedValue(undefined),
    };
    store = createAnnotationStore(driver);
    store.upsert({ id: "ann-1", shape: { type: "idah-image:mask" }, value: { category: "cat" } } as any);
  });

  it("delete() calls markOccupancyDirty once on success", async () => {
    await store.delete("ann-1");
    expect(mockMarkOccupancyDirty).toHaveBeenCalledTimes(1);
  });

  it("delete() does not call markOccupancyDirty on failure", async () => {
    driver.delete.mockRejectedValue(new Error("fail"));
    await expect(store.delete("ann-1")).rejects.toThrow();
    expect(mockMarkOccupancyDirty).not.toHaveBeenCalled();
  });

  it("setShape() calls markOccupancyDirty once on success", async () => {
    await store.setShape("ann-1", "tile-0x0", { rle: "AA==" });
    expect(mockMarkOccupancyDirty).toHaveBeenCalledTimes(1);
  });

  it("setShape() does not call markOccupancyDirty on failure", async () => {
    driver.setShape.mockRejectedValue(new Error("fail"));
    await expect(store.setShape("ann-1", "tile-0x0", { rle: "AA==" })).rejects.toThrow();
    expect(mockMarkOccupancyDirty).not.toHaveBeenCalled();
  });

  it("setShapes() calls markOccupancyDirty once on success", async () => {
    await store.setShapes("ann-1", [{ key: "tile-0x0", value: { rle: "AA==" } }]);
    expect(mockMarkOccupancyDirty).toHaveBeenCalledTimes(1);
  });

  it("setShapes() does not call markOccupancyDirty on failure", async () => {
    driver.setShapes.mockRejectedValue(new Error("fail"));
    await expect(store.setShapes("ann-1", [{ key: "tile-0x0", value: { rle: "AA==" } }])).rejects.toThrow();
    expect(mockMarkOccupancyDirty).not.toHaveBeenCalled();
  });

  it("create() does not call markOccupancyDirty", async () => {
    await store.create({ id: "ann-2", shape: { type: "idah-image:mask" }, value: { category: "cat" } } as any);
    expect(mockMarkOccupancyDirty).not.toHaveBeenCalled();
  });

  it("update() does not call markOccupancyDirty", async () => {
    await store.update({ id: "ann-1", shape: { type: "idah-image:mask", x: 10 }, value: { category: "cat" } } as any);
    expect(mockMarkOccupancyDirty).not.toHaveBeenCalled();
  });
});