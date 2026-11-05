// ---------------------------------------------------------------------------
// restore.test.ts — Tests for the annotation store's restore()
//
// restore() must insert the pre-delete snapshot into the local store
// immediately (the backend restore is enqueued by the driver, like every other
// write). A backend failure surfaces via onSyncError; the local record stays —
// there is no rollback.
//
// Image-specific: restore() calls markOccupancyDirty() so a restored mask
// annotation affects the occupancy grid.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAnnotationStore, type AnnotationItem } from "./data.svelte";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockMarkOccupancyDirty = vi.hoisted(() => vi.fn());

vi.mock("$lib/mask/occupancy", () => ({
  markOccupancyDirty: mockMarkOccupancyDirty,
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    isAnnotationSelected: () => false,
    deselectAnnotation: () => {},
    addAnnotations: () => {},
  },
}));

vi.mock("$lib/state/driver.svelte", () => ({
  getDriver: () => ({}),
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {},
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAnn(id: string, category = "vehicle/car"): AnnotationItem {
  return {
    id,
    shape_type: "idah-image:bounding-box",
    shape_args: { points: [[0, 0], [100, 100]] },
    category,
    properties: {},
  };
}

function makeDriver(overrides: {
  restore?: (id: string) => Promise<void>;
} = {}) {
  return {
    fetch: vi.fn(async () => []),
    create: vi.fn(async () => ({ id: "created" })),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    setShape: vi.fn(async () => {}),
    setShapes: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("annotation store restore()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts the snapshot locally and resolves with it", async () => {
    const driver = makeDriver();
    const store = createAnnotationStore(driver);

    const record = makeAnn("ann-001");
    const result = await store.restore(record);

    // The snapshot is present locally.
    expect(store.items.some((i) => i.id === "ann-001")).toBe(true);
    expect(driver.restore).toHaveBeenCalledWith("ann-001");
    expect(result).toEqual(record);
    // The insert marks occupancy dirty.
    expect(mockMarkOccupancyDirty).toHaveBeenCalled();
  });

  it("keeps the local record restored when the backend rejects (onSyncError handles it)", async () => {
    const driver = makeDriver({
      restore: vi.fn(async () => { throw new Error("check_entry_not_completed!"); }),
    });
    const store = createAnnotationStore(driver);

    // The snapshot is inserted locally, and the rejection propagates but does
    // not roll the local record back — the failure surfaces via onSyncError.
    await expect(store.restore(makeAnn("ann-001"))).rejects.toThrow("check_entry_not_completed!");
    expect(store.items.some((i) => i.id === "ann-001")).toBe(true);
  });

  it("marks occupancy dirty on the insert path", async () => {
    const driver = makeDriver();
    const store = createAnnotationStore(driver);
    await store.restore(makeAnn("ann-001"));
    expect(mockMarkOccupancyDirty).toHaveBeenCalledTimes(1);
  });
});
