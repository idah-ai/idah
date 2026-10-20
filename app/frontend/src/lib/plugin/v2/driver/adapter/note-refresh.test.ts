import { describe, it, expect, vi } from "vitest";
import { withNoteRefresh } from "@/plugin/v2/driver/adapter/note-refresh";
import { debounce } from "@/utils/delayed";
import { refetches } from "@/utils/refetch";
import type { IAnnotationRecord, IAnnotationsDriverV2 } from "@/plugin/v2/types";

function makeDriver(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn(async () => ({ data: [] })),
    create: vi.fn(async (r: { id: string }) => r),
    update: vi.fn(async (_id: string, _data: unknown) => {}),
    delete: vi.fn(async (_id: string) => {}),
    restore: vi.fn(async (id: string) => ({ id })),
    setShape: vi.fn(async (_id: string, _key: string, _value: object | null) => {}),
    setShapes: vi.fn(async (_id: string, _entries: Array<{ key: string; value: object | null }>) => {}),
    ...overrides,
  };
}

class ClassDriver implements IAnnotationsDriverV2 {
  calls: string[] = [];

  registerField(): void {
    this.calls.push("registerField");
  }
  async fetch(): Promise<IAnnotationRecord[]> {
    this.calls.push("fetch");
    return [];
  }
  async create(data: IAnnotationRecord): Promise<IAnnotationRecord> {
    this.calls.push("create");
    return data;
  }
  async update(_id: string, _data: unknown): Promise<void> {
    this.calls.push("update");
  }
  async delete(_id: string): Promise<void> {
    this.calls.push("delete");
  }
  async restore(id: string): Promise<IAnnotationRecord> {
    this.calls.push("restore");
    return { id } as IAnnotationRecord;
  }
  async setShape(): Promise<void> {
    this.calls.push("setShape");
  }
  async setShapes(): Promise<void> {
    this.calls.push("setShapes");
  }
}

describe("withNoteRefresh", () => {
  it("bumps the note list refetch after a successful delete", async () => {
    const driver = makeDriver();
    const originalDelete = driver.delete;
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    await wrapped.delete("ann-1");

    expect(originalDelete).toHaveBeenCalledWith("ann-1");
    expect(refreshNotes).toHaveBeenCalledTimes(1);
  });

  it("bumps the note list refetch after a successful restore", async () => {
    const driver = makeDriver();
    const originalRestore = driver.restore;
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    const result = await wrapped.restore("ann-1");

    expect(originalRestore).toHaveBeenCalledWith("ann-1");
    expect(result).toEqual({ id: "ann-1" });
    expect(refreshNotes).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when delete rejects, and still rejects to the caller", async () => {
    const driver = makeDriver({
      delete: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    await expect(wrapped.delete("ann-1")).rejects.toThrow("boom");
    expect(refreshNotes).not.toHaveBeenCalled();
  });

  it("does not refresh when restore rejects, and still rejects to the caller", async () => {
    const driver = makeDriver({
      restore: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    await expect(wrapped.restore("ann-1")).rejects.toThrow("boom");
    expect(refreshNotes).not.toHaveBeenCalled();
  });

  it("passes through non-mutating methods unchanged", async () => {
    const driver = makeDriver();
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    await wrapped.setShape("ann-1", "k", { a: 1 });
    await wrapped.setShapes("ann-1", [{ key: "k", value: null }]);
    await wrapped.update("ann-1", { category: "x" });

    expect(driver.setShape).toHaveBeenCalledTimes(1);
    expect(driver.setShapes).toHaveBeenCalledTimes(1);
    expect(driver.update).toHaveBeenCalledTimes(1);
    expect(refreshNotes).not.toHaveBeenCalled();
  });

  it("returns the same object and keeps class methods working after wrapping", async () => {
    const driver = new ClassDriver();
    const refreshNotes = vi.fn();
    const wrapped = withNoteRefresh(driver, refreshNotes);

    // Same instance is returned, not a shallow copy.
    expect(wrapped).toBe(driver);

    // Real class methods (not copied fields) still work after wrapping.
    await wrapped.fetch();
    await wrapped.update("ann-1", { category: "x" });
    expect(driver.calls).toEqual(["fetch", "update"]);

    // Overridden methods still refresh after resolve.
    await wrapped.delete("ann-1");
    await wrapped.restore("ann-1");
    expect(driver.calls).toEqual(["fetch", "update", "delete", "restore"]);
    expect(refreshNotes).toHaveBeenCalledTimes(2);
  });

  it("debounces multiple deletes into a single note-list bump", async () => {
    vi.useFakeTimers();
    try {
      const driver = makeDriver();
      const originalDelete = driver.delete;
      const refreshNotes = debounce(() => {
        refetches.update((s) => ({ ...s, noteFeeds: { ...s.noteFeeds, list: new Date() } }));
      }, 300);
      const wrapped = withNoteRefresh(driver, refreshNotes);

      let noteListBumps = 0;
      const unsub = refetches.subscribe((s) => {
        // Count only noteFeeds.list changes (ignore the initial emission).
        noteListBumps++;
        void s;
      });
      noteListBumps = 0;

      await wrapped.delete("ann-1");
      await wrapped.delete("ann-2");
      await wrapped.delete("ann-3");

      // Nothing bumped yet — debounce window still open.
      expect(noteListBumps).toBe(0);

      await vi.advanceTimersByTimeAsync(300);

      // Exactly one bump after the window elapses.
      expect(noteListBumps).toBe(1);
      expect(originalDelete).toHaveBeenCalledTimes(3);
      unsub();
    } finally {
      vi.useRealTimers();
    }
  });
});
