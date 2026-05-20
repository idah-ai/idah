// ---------------------------------------------------------------------------
// data.spec.ts — Unit tests for the DataStore
// ---------------------------------------------------------------------------
import { describe, it, expect, vi } from "vitest";
import { createDataStore, computeMissingRanges, type DataItem, type RangeFetchFn } from "./data.svelte";

// ─── Test helpers ─────────────────────────────────────────────────────────

interface TestAnnotation extends DataItem {
  id: string;
  frameStart: number;
  frameEnd: number;
}

function makeAnn(id: string, start: number, end: number): TestAnnotation {
  return { id, frameStart: start, frameEnd: end };
}

function createStore(
  initialItems: TestAnnotation[] = [],
  initialRange: [number, number] | null = null,
): { store: ReturnType<typeof createDataStore<TestAnnotation>>; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn<RangeFetchFn<TestAnnotation>>();
  fetchMock.mockResolvedValue(initialItems);
  const store = createDataStore<TestAnnotation>(fetchMock);
  store.getItemRange = (item) => [item.frameStart, item.frameEnd];
  if (initialRange) {
    store.reset(initialItems, initialRange);
  }
  return { store, fetchMock };
}

// ─── computeMissingRanges ─────────────────────────────────────────────────

describe("computeMissingRanges", () => {
  it("returns the full request when loaded is null", () => {
    expect(computeMissingRanges(null, [100, 200])).toEqual([[100, 200]]);
  });

  it("returns empty when request is fully inside the loaded range", () => {
    expect(computeMissingRanges([100, 200], [120, 180])).toEqual([]);
  });

  it("returns empty when request exactly matches the loaded range", () => {
    expect(computeMissingRanges([100, 200], [100, 200])).toEqual([]);
  });

  it("returns right tail when request extends beyond loaded range on the right", () => {
    expect(computeMissingRanges([100, 200], [100, 250])).toEqual([[201, 250]]);
  });

  it("returns left tail when request extends beyond loaded range on the left", () => {
    expect(computeMissingRanges([100, 200], [50, 200])).toEqual([[50, 99]]);
  });

  it("returns both tails when request extends on both sides", () => {
    expect(computeMissingRanges([100, 200], [50, 250])).toEqual([[50, 99], [201, 250]]);
  });

  it("returns full request when entirely before the loaded range", () => {
    expect(computeMissingRanges([100, 200], [0, 50])).toEqual([[0, 50]]);
  });

  it("returns full request when entirely after the loaded range", () => {
    expect(computeMissingRanges([100, 200], [300, 400])).toEqual([[300, 400]]);
  });

  it("returns empty when start > end", () => {
    expect(computeMissingRanges(null, [200, 100])).toEqual([]);
  });

  it("handles single-frame boundaries", () => {
    expect(computeMissingRanges([100, 200], [50, 100])).toEqual([[50, 99]]);
    expect(computeMissingRanges([100, 200], [200, 300])).toEqual([[201, 300]]);
  });

  it("returns empty when request touches the loaded boundaries", () => {
    expect(computeMissingRanges([100, 200], [100, 150])).toEqual([]);
    expect(computeMissingRanges([100, 200], [150, 200])).toEqual([]);
  });
});

// ─── preloadRange ─────────────────────────────────────────────────────────

describe("preloadRange", () => {
  it("fetches the initial range when loadedRange is null", async () => {
    const { store, fetchMock } = createStore([makeAnn("a1", 0, 50)]);

    expect(store.loadedRange).toBeNull();
    expect(store.items).toHaveLength(0);

    await store.preloadRange(0, 100);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(0, 100);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe("a1");
    expect(store.loadedRange).toEqual([0, 100]);
  });

  it("does not fetch when the range is already fully loaded", async () => {
    const { store, fetchMock } = createStore([makeAnn("a1", 50, 150)], [0, 200]);

    await store.preloadRange(50, 150);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.loadedRange).toEqual([0, 200]);
  });

  it("fetches only the right extension", async () => {
    const existing = [makeAnn("a1", 50, 150)];
    const { store, fetchMock } = createStore(existing, [0, 200]);

    fetchMock.mockResolvedValue([makeAnn("a2", 201, 250)]);
    await store.preloadRange(0, 300);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(201, 300);
    expect(store.items).toHaveLength(2);
    expect(store.loadedRange).toEqual([0, 300]);
  });

  it("fetches only the left extension", async () => {
    const existing = [makeAnn("a1", 50, 150)];
    const { store, fetchMock } = createStore(existing, [100, 200]);

    fetchMock.mockResolvedValue([makeAnn("a2", 0, 99)]);
    await store.preloadRange(0, 200);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(0, 99);
    expect(store.items).toHaveLength(2);
    expect(store.loadedRange).toEqual([0, 200]);
  });

  it("fetches both sides when extending in both directions", async () => {
    const existing = [makeAnn("a1", 120, 180)];
    const { store, fetchMock } = createStore(existing, [100, 200]);

    fetchMock
      .mockResolvedValueOnce([makeAnn("a2", 50, 99)])
      .mockResolvedValueOnce([makeAnn("a3", 201, 250)]);

    await store.preloadRange(50, 250);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 50, 99);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 201, 250);
    expect(store.items).toHaveLength(3);
    expect(store.loadedRange).toEqual([50, 250]);
  });

  it("deduplicates items by id", async () => {
    const existing = [makeAnn("a1", 50, 150)];
    const { store, fetchMock } = createStore(existing, [0, 200]);

    fetchMock.mockResolvedValue([makeAnn("a1", 50, 150)]);
    await store.preloadRange(0, 300);

    expect(store.items).toHaveLength(1);
    expect(store.loadedRange).toEqual([0, 300]);
  });

  it("extends loadedRange even when fetch returns empty", async () => {
    const { store, fetchMock } = createStore([], [100, 200]);
    fetchMock.mockResolvedValue([]);

    await store.preloadRange(100, 300);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store.items).toHaveLength(0);
    expect(store.loadedRange).toEqual([100, 300]);
  });

  it("does nothing when newStart > newEnd", async () => {
    const { store, fetchMock } = createStore([makeAnn("a1", 50, 150)], [0, 200]);

    await store.preloadRange(300, 200);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.loadedRange).toEqual([0, 200]);
  });

  it("is a no-op when the new range is a subset of loaded range", async () => {
    const { store, fetchMock } = createStore([makeAnn("a1", 50, 150)], [0, 1000]);

    await store.preloadRange(200, 300);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.loadedRange).toEqual([0, 1000]);
  });

  it("fetches a completely separate range before loaded", async () => {
    const existing = [makeAnn("a1", 300, 400)];
    const { store, fetchMock } = createStore(existing, [300, 500]);

    fetchMock.mockResolvedValue([makeAnn("a2", 0, 50)]);
    await store.preloadRange(0, 100);

    expect(fetchMock).toHaveBeenCalledWith(0, 100);
    expect(store.items).toHaveLength(2);
    expect(store.loadedRange).toEqual([0, 500]);
  });

  it("fetches a completely separate range after loaded", async () => {
    const existing = [makeAnn("a1", 50, 150)];
    const { store, fetchMock } = createStore(existing, [0, 200]);

    fetchMock.mockResolvedValue([makeAnn("a2", 500, 600)]);
    await store.preloadRange(500, 700);

    expect(fetchMock).toHaveBeenCalledWith(500, 700);
    expect(store.items).toHaveLength(2);
    expect(store.loadedRange).toEqual([0, 700]);
  });

  it("sets pending during the fetch and clears it after", async () => {
    const { store, fetchMock } = createStore([makeAnn("a1", 0, 50)], null);
    fetchMock.mockImplementation(async () => {
      await Promise.resolve();
      return [makeAnn("a1", 0, 50)];
    });

    const promise = store.preloadRange(0, 100);
    expect(store.pending).toBe(true);
    await promise;
    expect(store.pending).toBe(false);
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────

describe("cleanup", () => {
  function bigStore(n: number, range: [number, number] = [0, n]) {
    const items: TestAnnotation[] = [];
    for (let i = 0; i < n; i++) {
      items.push(makeAnn(`ann-${i}`, i, i + 1));
    }
    return createStore(items, range);
  }

  it("triggers default cleanup when item count exceeds maxItems", async () => {
    const { store, fetchMock } = bigStore(1500, [0, 1500]);
    store.maxItems = 1000;

    fetchMock.mockResolvedValue([]);
    await store.preloadRange(700, 800);

    // Default retention: [700, 800] + 50% margin = [650, 850]
    expect(store.items.length).toBeLessThanOrEqual(202); // items from frame 650 to 850
    expect(store.loadedRange![0]).toBe(650);
    expect(store.loadedRange![1]).toBe(850);
  });

  it("uses onCleanup callback when provided", async () => {
    const { store, fetchMock } = bigStore(1200, [0, 1200]);
    store.maxItems = 1000;
    store.onCleanup = () => [100, 300];

    fetchMock.mockResolvedValue([]);
    await store.preloadRange(200, 300);

    // Only items overlapping [100, 300] should remain
    expect(store.items.length).toBeLessThanOrEqual(202);
    expect(store.loadedRange).toEqual([100, 300]);
  });

  it("keeps items without frame info during cleanup", async () => {
    const fetchMock = vi.fn(async () => []);
    const store = createDataStore<DataItem>(fetchMock);
    store.getItemRange = () => null;
    store.maxItems = 2;
    store.reset([{ id: "a" }, { id: "b" }, { id: "c" }], [0, 100]);

    fetchMock.mockResolvedValue([]);
    await store.preloadRange(50, 60);

    // All kept because getItemRange returns null
    expect(store.items).toHaveLength(3);
  });
});

// ─── CRUD ─────────────────────────────────────────────────────────────────

describe("CRUD", () => {
  it("upsert adds a new item", () => {
    const store = createDataStore<DataItem>(async () => []);
    store.upsert({ id: "a1" });
    expect(store.items).toHaveLength(1);
  });

  it("upsert replaces an existing item with the same id", () => {
    const store = createDataStore<DataItem>(async () => []);
    store.upsert({ id: "a1" });
    store.upsert({ id: "a1", extra: true } as DataItem);
    expect(store.items).toHaveLength(1);
    expect((store.items[0] as any).extra).toBe(true);
  });

  it("remove deletes an item by id", () => {
    const store = createDataStore<DataItem>(async () => []);
    store.reset([{ id: "a1" }, { id: "a2" }], [0, 10]);
    store.remove("a1");
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe("a2");
  });

  it("reset replaces items and loadedRange", () => {
    const store = createDataStore<DataItem>(async () => []);
    store.reset([{ id: "a1" }], [10, 20]);
    expect(store.items).toHaveLength(1);
    expect(store.loadedRange).toEqual([10, 20]);
  });

  it("clear empties everything", () => {
    const store = createDataStore<DataItem>(async () => []);
    store.reset([{ id: "a1" }], [0, 100]);
    store.clear();
    expect(store.items).toHaveLength(0);
    expect(store.loadedRange).toBeNull();
  });
});
