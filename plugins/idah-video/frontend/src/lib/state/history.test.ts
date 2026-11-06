// ---------------------------------------------------------------------------
// history.test.ts — History panel store tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { history } from "./history.svelte";
import { initDriver, getDriver } from "./driver.svelte";
import { selection } from "./selection.svelte";

function makeDriver() {
  const changes = vi.fn().mockResolvedValue({ items: [], total: 0 });
  const fetch = vi.fn().mockResolvedValue([]);
  const invalidate = vi.fn();
  return {
    annotations: { changes, fetch },
    toolbar: { invalidate },
    onModeChange: vi.fn(),
    onSyncChange: vi.fn(),
    onSyncError: vi.fn(),
  };
}

describe("history store", () => {
  let mock: ReturnType<typeof makeDriver>;

  beforeEach(() => {
    mock = makeDriver();
    initDriver(mock as never);
    selection.deselect();
    history.close();
    mock.annotations.changes.mockReset();
    mock.annotations.changes.mockResolvedValue({ items: [], total: 0 });
  });

  it("toggle opens and loads, and the toolbar follows", async () => {
    const change = {
      id: "c-1",
      annotation_id: "a-1",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 2,
      changed_at: Date.UTC(2026, 9, 30, 5, 14, 55),
    };
    // First open fetches page 1 unanchored in a single call.
    mock.annotations.changes.mockResolvedValue({ items: [change], total: 1 });

    history.toggle();
    expect(history.open).toBe(true);
    expect(mock.toolbar.invalidate).toHaveBeenCalled();
    await vi.waitFor(() => expect(history.items.length).toBe(1));
    expect(history.total).toBe(1);
    expect(mock.annotations.changes).toHaveBeenCalledTimes(1);
    expect(mock.annotations.changes).toHaveBeenCalledWith(expect.objectContaining({ filters: {}, page: 1, size: 50 }));
  });

  it("close hides and invalidates", () => {
    history.toggle();
    history.close();
    expect(history.open).toBe(false);
    expect(mock.toolbar.invalidate).toHaveBeenCalled();
  });

  it("scope follows the selection reactively", async () => {
    mock.annotations.changes.mockResolvedValue({ items: [], total: 200 });
    history.toggle();
    await vi.waitFor(() => expect(history.total).toBe(200));

    // Nothing selected: whole entry.
    expect(history.scope.kind).toBe("entry");
    expect(history.scopeAnnotationIds).toEqual([]);

    selection.selectAnnotation({ id: "a-1" } as never);
    await vi.waitFor(() => expect(history.scope.kind).toBe("annotations"));
    expect(history.scopeAnnotationIds).toEqual(["a-1"]);

    // Deselecting returns to the whole entry.
    selection.deselect();
    await vi.waitFor(() => expect(history.scope.kind).toBe("entry"));
  });

  it("loads with the selection filter when the selection changes", async () => {
    mock.annotations.changes.mockResolvedValue({ items: [], total: 200 });
    history.toggle();
    await vi.waitFor(() => expect(history.total).toBe(200));

    // Select an annotation, then reload: the query must filter to it.
    selection.selectAnnotation({ id: "a-1" } as never);
    await vi.waitFor(() => expect(history.scope.kind).toBe("annotations"));
    mock.annotations.changes.mockClear();
    await history.load();
    expect(mock.annotations.changes).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ annotation_id__in: ["a-1"] }) }),
    );
  });

  it("refresh keeps the page, clamped", async () => {
    // Anchor call returns an empty list (no changes), then the page call.
    mock.annotations.changes.mockResolvedValue({ items: [], total: 1000 });
    history.toggle();
    await vi.waitFor(() => expect(history.total).toBe(1000));
    history.goToPage(5);
    expect(history.page).toBe(5);

    // refresh() re-anchors (first call) then loads the page (second call).
    mock.annotations.changes
      .mockResolvedValueOnce({ items: [], total: 100 })
      .mockResolvedValueOnce({ items: [], total: 100 });
    await history.refresh();
    expect(history.page).toBe(2); // clamped to the new last page (100/50 = 2)
  });

  it("mixed selection shows the union", async () => {
    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(0));
    selection.selectAnnotations(["a-1"]);
    selection.toggleGroup("g1");
    await vi.waitFor(() => expect(history.scope.kind).toBe("mixed"));
    expect(history.scopeLabel).toContain("1 annotation");
    expect(history.scopeLabel).toContain("1 group");
    expect(history.scopeAnnotationIds).toEqual(["a-1"]);
  });

  it("group scope includes deleted members from the local cache", async () => {
    // The store's data holds live members of g1; the deleted fetch returns a
    // tombstone that also belongs to g1.
    mock.annotations.fetch.mockImplementation((filter?: Record<string, unknown>) => {
      if (filter?.deleted === "true") {
        return Promise.resolve([{ id: "del-1", metadata: { group_id: "g1" } }]);
      }
      return Promise.resolve([]);
    });
    history.toggle();
    await vi.waitFor(() => expect(history.scope.kind).toBe("entry"));

    selection.toggleGroup("g1");
    await vi.waitFor(() => expect(history.scope.kind).toBe("groups"));
    // A group scope reloads tombstones, so the deleted member is included.
    await history.load();
    expect(history.scopeAnnotationIds).toContain("del-1");
  });

  it("fetches a card's diff lazily on open and caches it", async () => {
    const change = {
      id: "c-1",
      annotation_id: "a-1",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 2,
      changed_at: Date.now(),
    };
    // First call loads the page (headers only); second fetches the diff.
    mock.annotations.changes
      .mockResolvedValueOnce({ items: [change], total: 1 })
      .mockResolvedValueOnce({ items: [{ ...change, changes: [["~", "category", "cat", "dog"]] }], total: 1 });
    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(1));

    // The page load does not request the diff payload.
    expect(mock.annotations.changes).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ fields: expect.arrayContaining(["changes"]) }),
    );
    expect(history.getDiff("c-1")).toBeUndefined();

    // Opening the card fetches just that change's diff.
    history.toggleCard("c-1");
    await vi.waitFor(() => expect(history.getDiff("c-1")).toEqual([["~", "category", "cat", "dog"]]));
    expect(mock.annotations.changes).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filters: { id__in: ["c-1"] }, size: 1 }),
    );
  });

  it("drops the diff cache and opened state when leaving a page", async () => {
    const c1 = {
      id: "x-1",
      annotation_id: "a-1",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 2,
      changed_at: Date.now(),
    };
    const c2 = {
      id: "x-2",
      annotation_id: "a-2",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 3,
      changed_at: Date.now(),
    };
    // Page load (x-1), then diff fetch for x-1.
    mock.annotations.changes
      .mockResolvedValueOnce({ items: [c1], total: 100 })
      .mockResolvedValueOnce({ items: [{ ...c1, changes: [["~", "category", "cat", "dog"]] }], total: 100 });
    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(1));

    history.toggleCard("x-1");
    await vi.waitFor(() => expect(history.getDiff("x-1")).toEqual([["~", "category", "cat", "dog"]]));
    expect(history.isCardOpen("x-1")).toBe(true);

    // Navigate to page 2: x-1 is no longer visible, so its diff and open state
    // must be dropped to avoid unbounded memory growth.
    mock.annotations.changes.mockResolvedValueOnce({ items: [c2], total: 100 });
    history.goToPage(2);
    await vi.waitFor(() => expect(history.items[0]?.id).toBe("x-2"));
    expect(history.getDiff("x-1")).toBeUndefined();
    expect(history.isCardOpen("x-1")).toBe(false);
  });

  it("ignores an out-of-order response from an older load", async () => {
    const changeA = {
      id: "a",
      annotation_id: "a-1",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 2,
      changed_at: Date.now() - 1000,
    };
    const changeB = {
      id: "b",
      annotation_id: "a-1",
      account_id: 1,
      account_email: "u@example.com",
      op: "updated",
      version: 3,
      changed_at: Date.now(),
    };
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    mock.annotations.changes
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)));

    history.toggle(); // first load (token 1)
    const second = history.load(); // second load (token 2, supersedes)

    // Resolve the second load first; the first must not overwrite it.
    resolveSecond({ items: [changeB], total: 1, hasMore: false });
    await second;
    resolveFirst({ items: [changeA], total: 1, hasMore: false });

    // Flush the first load's continuation so it has a chance to (wrongly)
    // overwrite the page; the token guard must keep the second load's items.
    await new Promise((r) => setTimeout(r, 0));
    expect(history.items.map((c) => c.id)).toEqual(["b"]);
    expect(history.total).toBe(1);
  });

  it("pager reads hasMore and keeps moving to the real end", async () => {
    // A mock that behaves like the backend: count = offset + min(1000, remaining),
    // more when rows remain past that count.
    const totalRows = 2600;
    mock.annotations.changes.mockImplementation(({ page = 1, size = 50 } = {}) => {
      const offset = (page - 1) * size;
      const remaining = totalRows - offset;
      const count = offset + Math.min(1000, remaining);
      const more = count < totalRows;
      const items = Array.from({ length: Math.min(size, remaining) }, (_, i) => ({
        id: `c-${offset + i}`,
        annotation_id: "a-1",
        account_id: 1,
        account_email: "u@example.com",
        op: "updated",
        version: 1,
        changed_at: Date.now() - (offset + i),
      }));
      return Promise.resolve({ items, total: count, hasMore: more });
    });

    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(50));
    expect(history.total).toBe(1000); // 0 + min(1000, 2600)
    expect(history.hasMore).toBe(true);
    expect(history.pageCount).toBe(20);
    expect(history.atStartOfHistory).toBe(false);

    // Oldest → page 20 (offset 950): reports 1950 with more.
    history.goToOldest();
    await vi.waitFor(() => expect(history.page).toBe(20));
    await vi.waitFor(() => expect(history.total).toBe(1950));
    expect(history.hasMore).toBe(true);
    expect(history.pageCount).toBe(39);

    // Oldest → page 39 (offset 1900): reports exactly 2600, so the count is exact.
    history.goToOldest();
    await vi.waitFor(() => expect(history.page).toBe(39));
    await vi.waitFor(() => expect(history.total).toBe(2600));
    expect(history.hasMore).toBe(false);
    expect(history.pageCount).toBe(52);

    // Oldest → page 52: start of history.
    history.goToOldest();
    await vi.waitFor(() => expect(history.page).toBe(52));
    expect(history.atStartOfHistory).toBe(true);
  });

  it("start of history never shows while hasMore is true", async () => {
    const totalRows = 2600;
    mock.annotations.changes.mockImplementation(({ page = 1, size = 50 } = {}) => {
      const offset = (page - 1) * size;
      const remaining = totalRows - offset;
      const count = offset + Math.min(1000, remaining);
      const more = count < totalRows;
      const items = Array.from({ length: Math.min(size, remaining) }, (_, i) => ({
        id: `c-${offset + i}`,
        annotation_id: "a-1",
        account_id: 1,
        account_email: "u@example.com",
        op: "updated",
        version: 1,
        changed_at: Date.now() - (offset + i),
      }));
      return Promise.resolve({ items, total: count, hasMore: more });
    });

    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(50));
    expect(history.atStartOfHistory).toBe(false);

    history.goToOldest();
    await vi.waitFor(() => expect(history.page).toBe(20));
    expect(history.hasMore).toBe(true);
    expect(history.atStartOfHistory).toBe(false);
  });

  it("empty, error and offline states", async () => {
    history.toggle();
    await vi.waitFor(() => expect(history.items.length).toBe(0));
    expect(history.total).toBe(0);

    mock.annotations.changes.mockRejectedValueOnce(new Error("offline"));
    await history.refresh();
    expect(history.error).toBe("offline");
    expect(history.items.length).toBe(0);
  });
});
