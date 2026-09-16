// ---------------------------------------------------------------------------
// restore.test.ts — Tests for the annotation store's optimistic restore()
//
// restore() must insert the pre-delete snapshot into the local store
// immediately (before the backend round-trip), reconcile with the backend's
// authoritative response on success, and roll back the optimistic insert if
// the backend rejects the restore (e.g. check_entry_not_completed! fails).
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createAnnotationStore, type AnnotationItem } from "./data.svelte";

// ── Mocks ──────────────────────────────────────────────────────────────────
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
    shape_type: "idah-video:bounding-box",
    shape_args: { start: 0, end: 10, frames: [] },
    category,
    properties: {},
  };
}

function makeDriver(overrides: Partial<{
  restore: (id: string) => Promise<{ id: string } & Record<string, unknown>>;
}> = {}) {
  return {
    fetch: vi.fn(async () => []),
    create: vi.fn(async () => ({ id: "created" })),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    restore: vi.fn(async (id: string) => ({ id, shape_type: "idah-video:bounding-box", shape_args: { start: 0, end: 10, frames: [] }, category: "vehicle/car", properties: {} })),
    ...overrides,
  };
}

describe("annotation store restore()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts the snapshot optimistically before the driver resolves", async () => {
    const driver = makeDriver();
    const store = createAnnotationStore(driver);

    const record = makeAnn("ann-001");
    // Drive the restore but don't await it yet — the optimistic insert must
    // already be visible before the driver's promise resolves.
    const pending = store.restore(record);

    // The snapshot is present locally immediately.
    expect(store.items.some((i) => i.id === "ann-001")).toBe(true);
    expect(driver.restore).toHaveBeenCalledWith("ann-001");

    await pending;
    // Still present after reconciliation.
    expect(store.items.some((i) => i.id === "ann-001")).toBe(true);
  });

  it("reconciles the optimistic record with the backend response on success", async () => {
    const backendRecord = {
      id: "ann-001",
      shape_type: "idah-video:polygon",
      shape_args: { start: 0, end: 20, frames: [] },
      category: "vehicle/truck",
      properties: { color: "red" },
    };
    const driver = makeDriver({ restore: vi.fn(async () => backendRecord) });
    const store = createAnnotationStore(driver);

    await store.restore(makeAnn("ann-001"));

    const stored = store.items.find((i) => i.id === "ann-001");
    expect(stored?.shape_type).toBe("idah-video:polygon");
    expect(stored?.category).toBe("vehicle/truck");
    expect((stored?.properties as any)?.color).toBe("red");
  });

  it("rolls back the optimistic insert when the driver rejects", async () => {
    const driver = makeDriver({
      restore: vi.fn(async () => { throw new Error("check_entry_not_completed!"); }),
    });
    const store = createAnnotationStore(driver);

    // The snapshot is inserted optimistically...
    const pending = store.restore(makeAnn("ann-001"));
    expect(store.items.some((i) => i.id === "ann-001")).toBe(true);

    // ...but must be removed again when the backend rejects.
    await expect(pending).rejects.toThrow("Failed to restore annotation");
    expect(store.items.some((i) => i.id === "ann-001")).toBe(false);
  });
});