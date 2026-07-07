// ---------------------------------------------------------------------------
// data.svelte.ts — Generic range‑based in‑memory data store
//
// Holds a collection of items (annotations, notes, …) and a `loadedRange`
// that tracks which frame region is currently buffered.
//
// `preloadRange(newStart, newEnd)` fetches only the segments not already
// in memory, merges new items, and optionally cleans up old ones when the
// collection grows beyond a threshold.
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { uuidv7 } from "uuidv7";

/** Minimum interface an item must expose. */
export interface DataItem {
  id: string;
}

/** Signature of the external fetch function. */
export type RangeFetchFn<T extends DataItem> = (rangeStart: number, rangeEnd: number) => Promise<T[]>;

/**
 * How to extract the frame range from an item.
 * Return `null` if the item doesn't carry frame info (it will be kept on cleanup).
 */
export type GetItemRange<T> = (item: T) => [number, number] | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given the current loaded range and a requested range,
 * return the sub‑ranges of `requested` that are NOT already covered.
 *
 * Returns an array of `[start, end]` segments (inclusive on both sides).
 */
export function computeMissingRanges(loaded: [number, number] | null, request: [number, number]): [number, number][] {
  const [rStart, rEnd] = request;
  if (rStart > rEnd) return [];

  if (loaded === null) {
    return [[rStart, rEnd]];
  }

  const [lStart, lEnd] = loaded;

  // No overlap at all
  if (rEnd < lStart) {
    return [[rStart, rEnd]];
  }
  if (rStart > lEnd) {
    return [[rStart, rEnd]];
  }

  // At least partial overlap
  const missing: [number, number][] = [];

  if (rStart < lStart) {
    missing.push([rStart, lStart - 1]);
  }
  if (rEnd > lEnd) {
    missing.push([lEnd + 1, rEnd]);
  }

  return missing;
}

// ---------------------------------------------------------------------------
// DataStore factory
// ---------------------------------------------------------------------------

export interface DataStore<T extends DataItem> {
  readonly items: T[];
  readonly loadedRange: [number, number] | null;
  readonly pending: boolean;

  preloadRange(newStart: number, newEnd: number): Promise<void>;
  remove(id: string): void;
  upsert(item: T): void;

  /**
   * Append items without the per-item dedup scan `upsert` performs.
   * O(n) for the whole batch instead of O(n·m). Fast path for bulk/streaming
   * loads where the caller guarantees the items are not already present.
   */
  bulkAppend(items: T[]): void;
  reset(items: T[], range: [number, number]): void;
  clear(): void;

  /**
   * Create a new item: generate an id (or use the one provided), insert locally, then persist.
   */
  create(data: Partial<T> & { id?: string }): Promise<T>;

  /**
   * Delete an item by id on the driver, then remove it from the local store.
   */
  delete(id: string): Promise<void>;

  /**
   * Update an item on the driver, then replace it in the local store.
   */
  update(item: T): Promise<void>;

  /** Configurable threshold — when item count exceeds this, cleanup runs. */
  maxItems: number;

  /** Optional cleanup callback — receives proposed range + count, returns range to retain. */
  onCleanup: ((proposedLoadedRange: [number, number], currentCount: number) => [number, number]) | undefined;

  /** Override to tell the store how to extract frame range from items. */
  getItemRange: GetItemRange<T>;
}

// ─── Annotation store factory ──────────────────────────────────────────

export type AnnotationItem = {
  id: string;
  shape: { type: string } & Record<string, unknown>;
  value?: { category?: string; label?: string; attributes?: Record<string, unknown>; [key: string]: unknown };
  metadata?: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  synced?: boolean;
  [key: string]: unknown;
};

/**
 * Create a DataStore pre-configured for annotations.
 *
 * The `fetchFn` is bound to the driver so the store can query only the
 * missing frame ranges on demand.
 *
 * @param driver  An object with a `fetch(filter?)` method compatible with
 *                `IAnnotationsDriverV2`.
 * @returns       A DataStore wired up for annotations.
 */
export interface AnnotationDriver {
  fetch(
    filter?: Record<string, unknown>,
    onBatch?: (records: Record<string, unknown>[]) => void,
  ): Promise<Record<string, unknown>[]>;
  create(data: Record<string, unknown>): Promise<{ id: string } & Record<string, unknown>>;
  update(id: string, data: Record<string, unknown>): Promise<void>;
  delete(id: string): Promise<void>;
}

function syncSelectionOnUpdate(updatedId: string): void {
  if (selection.value?.id === updatedId) {
    const store = data.annotations;
    if (!store) return;
    const fresh = store.items.find((i) => i.id === updatedId);
    if (fresh) selection.selectAnnotation(fresh);
  }
}

function syncSelectionOnDelete(deletedId: string): void {
  if (selection.value?.id === deletedId) {
    selection.deselect();
  }
}

export function createAnnotationStore(driver: AnnotationDriver): DataStore<AnnotationItem> {
  const store = createDataStore<AnnotationItem>(async () => {
    // Paint each page as it lands so a large load renders progressively
    // instead of blocking on the full dataset. bulkAppend is idempotent, so
    // duplicate/overlapping batches (e.g. a warm delta re-emitted by the full
    // read) are skipped without any local bookkeeping here.
    const items = await driver.fetch(undefined, (batch) => {
      store.bulkAppend(batch as AnnotationItem[]);
    });
    return items as AnnotationItem[];
  });

  store.getItemRange = () => null;

  const originalUpsert = store.upsert.bind(store);

  return {
    // ── Delegate getters/setters directly (NOT via spread, which would
    //     evaluate $state getters once and lose reactivity) ──────────
    get items() {
      return store.items;
    },
    get loadedRange() {
      return store.loadedRange;
    },
    get pending() {
      return store.pending;
    },
    get maxItems() {
      return store.maxItems;
    },
    set maxItems(v) {
      store.maxItems = v;
    },
    get onCleanup() {
      return store.onCleanup;
    },
    set onCleanup(v) {
      store.onCleanup = v;
    },
    get getItemRange() {
      return store.getItemRange;
    },
    set getItemRange(v) {
      store.getItemRange = v;
    },
    preloadRange: (s: number, e: number) => store.preloadRange(s, e),
    remove: (id: string) => store.remove(id),
    upsert: (item: AnnotationItem) => {
      originalUpsert(item);
    },
    bulkAppend: (items: AnnotationItem[]) => store.bulkAppend(items),
    reset: (items: AnnotationItem[], range: [number, number]) => store.reset(items, range),
    clear: () => store.clear(),

    async create(data: Partial<AnnotationItem> & { id?: string }): Promise<AnnotationItem> {
      const id = data.id ?? uuidv7();
      const item = { ...data, id } as AnnotationItem;
      // Optimistic: insert locally first
      originalUpsert(item);
      try {
        await driver.create($state.snapshot({ ...data, id }));
      } catch {
        // Rollback on failure
        store.remove(id);
        throw new Error("Failed to create annotation");
      }
      return item;
    },

    async delete(id: string): Promise<void> {
      const item = store.items.find((i) => i.id === id);
      // Optimistic: remove locally first + deselect if it was selected
      syncSelectionOnDelete(id);
      store.remove(id);
      try {
        await driver.delete(id);
      } catch {
        // Rollback
        if (item) originalUpsert(item);
        throw new Error("Failed to delete annotation");
      }
    },

    async update(item: AnnotationItem): Promise<void> {
      const old = store.items.find((i) => i.id === item.id);
      // Optimistic: update locally first + refresh selection reference
      originalUpsert(item);
      syncSelectionOnUpdate(item.id);
      try {
        await driver.update(item.id, $state.snapshot(item));
      } catch {
        // Rollback
        if (old) originalUpsert(old);
        throw new Error("Failed to update annotation");
      }
    },
  };
}

// ─── Note store (push-based) ─────────────────────────────────────────────

export type NoteItem = {
  id: string;
  [key: string]: unknown;
};

export interface PendingNoteEntry {
  type: "entry";
  /** Scene normalized position (0-1) */
  x: number;
  y: number;
}

export interface PendingNoteAnnotation {
  type: "annotation";
  /** Annotation ID the note is anchored to */
  annotationId: string;
  /** Normalised offset from the annotation centroid (0-1) */
  x: number;
  y: number;
}

export type PendingNoteScene = PendingNoteEntry | PendingNoteAnnotation | null;

let _pendingNoteScene: PendingNoteScene = $state(null);

export function setPendingNoteScene(pos: PendingNoteScene): void {
  _pendingNoteScene = pos;
}

export const pendingNoteScene = {
  get value(): PendingNoteScene { return _pendingNoteScene; },
};

export function createDataStore<T extends DataItem>(fetchFn: RangeFetchFn<T>): DataStore<T> {
  // ── Internal state ──────────────────────────────────────────────────
  let items = $state<T[]>([]);
  // Membership index kept in sync with `items` on every mutation. Plain (not
  // $state) — it's an internal lookup, not rendered. Gives O(1) dedup so
  // bulkAppend is idempotent (safe against retried/overlapping loads) without
  // an O(n²) scan.
  const ids = new Set<string>();
  let loadedRange: [number, number] | null = $state(null);
  let pending = $state(false);
  let maxItems = 1000;
  let onCleanup: DataStore<T>["onCleanup"] = undefined;
  let getItemRange: GetItemRange<T> = () => null;

  // ── Internal helpers ────────────────────────────────────────────────

  function extendLoadedRange(newStart: number, newEnd: number): void {
    if (loadedRange === null) {
      loadedRange = [newStart, newEnd];
    } else {
      loadedRange = [Math.min(loadedRange[0], newStart), Math.max(loadedRange[1], newEnd)];
    }
  }

  function maybeCleanup(currentStart: number, currentEnd: number): void {
    if (loadedRange === null) return;

    // Determine which range to retain
    let retainRange: [number, number];
    if (onCleanup) {
      retainRange = onCleanup(loadedRange, items.length);
    } else {
      // Default: extend the current viewport range by 50 % on each side
      const margin = (currentEnd - currentStart) * 0.5;
      retainRange = [Math.max(0, currentStart - margin), currentEnd + margin];
    }

    // Remove items whose range doesn't overlap with retainRange
    const old = items.splice(0, items.length); // drain first
    ids.clear();
    for (const item of old) {
      const range = getItemRange(item);
      if (range === null) {
        ids.add(item.id);
        items.push(item); // keep items without frame info
      } else if (range[0] <= retainRange[1] && range[1] >= retainRange[0]) {
        ids.add(item.id);
        items.push(item);
      }
    }

    loadedRange = retainRange;
  }

  // ── Public API ──────────────────────────────────────────────────────

  async function preloadRange(newStart: number, newEnd: number): Promise<void> {
    if (newStart > newEnd) return;

    pending = true;

    try {
      const missingRanges = computeMissingRanges(loadedRange, [newStart, newEnd]);

      if (missingRanges.length > 0) {
        // Fetch each missing range and merge (bulkAppend dedups by id, so it's
        // safe whether records arrive here via the return value or already
        // landed through a streaming onBatch callback).
        for (const [segStart, segEnd] of missingRanges) {
          const fetched = await fetchFn(segStart, segEnd);
          if (fetched.length > 0) bulkAppend(fetched);
        }

        // Always extend loaded range so we don't re-fetch empty regions
        extendLoadedRange(newStart, newEnd);
      }

      // Always run cleanup check after a preload attempt
      if (items.length > maxItems) {
        maybeCleanup(newStart, newEnd);
      }
    } finally {
      pending = false;
    }
  }

  function remove(id: string): void {
    const idx = items.findIndex((i) => i.id === id);
    if (idx !== -1) {
      items.splice(idx, 1);
      ids.delete(id);
    }
  }

  function upsert(item: T): void {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      items[idx] = item;
    } else {
      ids.add(item.id);
      items.push(item);
    }
  }

  function bulkAppend(newItems: T[]): void {
    for (const item of newItems) {
      if (ids.has(item.id)) continue; // idempotent: skip records already present
      ids.add(item.id);
      items.push(item);
    }
  }

  function reset(initialItems: T[], range: [number, number]): void {
    items.length = 0;
    ids.clear();
    for (const item of initialItems) {
      if (ids.has(item.id)) continue;
      ids.add(item.id);
      items.push(item);
    }
    loadedRange = range;
  }

  function clear(): void {
    items.length = 0;
    ids.clear();
    loadedRange = null;
  }

  return {
    get items() {
      return items;
    },
    get loadedRange() {
      return loadedRange;
    },
    get pending() {
      return pending;
    },

    preloadRange,
    remove,
    upsert,
    bulkAppend,
    reset,
    clear,

    async delete(_id: string): Promise<void> {
      // Base store has no driver; specialized stores override this.
      throw new Error("delete not implemented — use createAnnotationStore or createNoteStore");
    },

    async update(_item: T): Promise<void> {
      throw new Error("update not implemented — use createAnnotationStore or createNoteStore");
    },

    async create(data: Partial<T> & { id?: string }): Promise<T> {
      throw new Error("create not implemented — use createAnnotationStore or createNoteStore");
    },

    get maxItems() {
      return maxItems;
    },
    set maxItems(v: number) {
      maxItems = v;
    },

    get onCleanup() {
      return onCleanup;
    },
    set onCleanup(v) {
      onCleanup = v;
    },

    get getItemRange() {
      return getItemRange;
    },
    set getItemRange(v) {
      getItemRange = v;
    },
  };
}

// ─── Global singleton stores ─────────────────────────────────────────────-
//
// These automatically initialise from the global V2 driver as soon as it
// becomes available (set by idah-image-plugin.svelte on mount).
//
// Usage:
//   import { data } from "$lib/state/data.svelte";
//   data.annotations.preloadRange(-Infinity, Infinity);

import { getDriver } from "$lib/state/driver.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { INoteRecord } from "$idah/v2/types";

let _annotations: DataStore<AnnotationItem> | null = $state(null);

let _noteList: INoteRecord[] = $state([]);
let _unsubNotes: (() => void) | null = null;

/** Initialise the stores from the global driver. Call once after initDriver(). */
export function initDataStores(): void {
  const d = getDriver();
  if (!d) throw new Error("Driver not initialized — call initDriver() first");
  _annotations = createAnnotationStore(d.annotations);
  _annotations.preloadRange(-Infinity, Infinity);

  _unsubNotes = d.notes.onNotesChange((notes: INoteRecord[]) => {
    _noteList = notes;
  });

  // onFocusNote is registered in NoteMarkers.svelte onMount
}

/** Cleanup note subscriptions — call from plugin.close(). */
export function destroyDataStores(): void {
  _unsubNotes?.();
  _unsubNotes = null;
  _annotations = null;
  _noteList = [];
}

/**
 * Reactive note list — kept in sync via onNotesChange.
 * Read-only accessor for the plugin's NoteMarkers component.
 */
export const notes = {
  get list(): INoteRecord[] { return _noteList; },
};

let _activeNoteId: string | null = $state(null);

/**
 * The currently selected/focused note ID.
 * Set by NoteMarkers when a marker is clicked.
 * NoteMarkers uses this to trigger the position-reporting rAF loop.
 */
export const activeNoteId = {
  get value(): string | null { return _activeNoteId; },
  set value(id: string | null) { _activeNoteId = id; },
};

/** Global stores — auto-initialised from the V2 driver. */
/**
 * Focus a note — center the annotation (or fit viewport),
 * set it as the active note, and notify the core.
 * The position-reporting $effect in NoteMarkers.svelte handles the follow-up
 * `reportNotePosition` call automatically.
 */
export function focusNote(note: INoteRecord): void {
  const driver = getDriver();

  // Clear any pending (ghost) note marker — we're focusing a real note now.
  // This prevents stale ghost markers from remaining in the viewport or
  // causing NoteMarkers to report the wrong overlay position.
  setPendingNoteScene(null);

  // 1. Select & center annotation if annotation-anchored
  if (note.anchor.anchor_type === "annotation" && note.anchor.annotation_id) {
    const ann = data.annotations?.items?.find(a => a.id === note.anchor.annotation_id);
    if (ann) {
      selection.selectAnnotation(ann);
      driver.command.call("selection.center");
    } else {
      // Annotations not loaded yet — defer until they are
      const stop = $effect.root(() => {
        $effect(() => {
          const found = data.annotations?.items?.find(a => a.id === note.anchor.annotation_id);
          if (!found) return;
          selection.selectAnnotation(found);
          driver.command.call("selection.center");
          stop();
        });
      });
    }
  } else {
    viewport.workspace.fitToViewport();
  }

  // 2. Set active note and notify core
  activeNoteId.value = note.id;
  driver.notes.selectNote(note.id);
  // reportNotePosition will follow automatically via NoteMarkers' $effect
}

export const data: {
  annotations: DataStore<AnnotationItem> | null;
} = {
  get annotations() {
    return _annotations;
  },
};
