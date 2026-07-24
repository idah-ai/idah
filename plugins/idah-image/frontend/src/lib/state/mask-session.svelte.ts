// ---------------------------------------------------------------------------
// mask-session.svelte.ts — In-memory, per-gesture mask paint state
//
// Tracks the current mask annotation that is being painted, the per-tile
// pixel buffers, which tiles have been modified (dirty set), and the
// current add/remove mode.
//
// One session per gesture. Hydrates from existing shape data on first
// touch of a tile. Discarded via `reset()` on gesture cancellation.
//
// Performance:
//   - All data structures are plain Maps/Sets mutated in-place (no O(n) copies).
//   - Reactivity is driven by a callback subscription pattern rather than
//     $state, to avoid coupling with Svelte's $effect dependency tracking.
//     MaskCanvasLayer.svelte subscribes to onChange() in onMount, and the
//     callback calls scheduleRedraw() which uses rAF batching.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { decode } from "$lib/mask/rle";
import { tileKey } from "$lib/mask/grid";

// ─── Session state ───────────────────────────────────────────────────────

let _annotationId: string | undefined = $state(undefined);

/**
 * Per-tile pixel buffers. Keyed by `"col:row"` (numeric, for fast lookup).
 * Each buffer is a flat Uint8Array of size MASK_TILE_SIZE × MASK_TILE_SIZE.
 *
 * NOT reactive — mutated in-place.  Consumers subscribe via onChange().
 */
let _tileBuffers: Map<string, Uint8Array> = new Map();

/**
 * Set of tile keys that have been modified during this gesture.
 *
 * NOT reactive — mutated in-place.  Consumers subscribe via onChange().
 */
let _dirty: Set<string> = new Set();

/**
 * Per-tile version counters for session tile rasterization caching.
 * Keyed by "col:row". Incremented each time a tile's buffer is modified.
 * NOT reactive — read by the renderer in rAF callbacks.
 */
const _tileVersions = new Map<string, number>();

/**
 * Current paint mode — "add" paints pixels, "remove" erases them.
 */
let _mode: "add" | "remove" = $state("add");

/**
 * Change listeners — called on every mutation so the renderer can
 * schedule a redraw.  This avoids $state reactivity for the hot path
 * (every pointermove during a brush stroke).
 */
const _listeners = new Set<() => void>();

function notify(): void {
  for (const fn of _listeners) fn();
}

// ─── Public API ──────────────────────────────────────────────────────────

export const maskSession = {
  // ── Read-only getters ────────────────────────────────────────────────

  get annotationId(): string | undefined {
    return _annotationId;
  },

  set annotationId(id: string | undefined) {
    _annotationId = id
  },

  get tileBuffers(): ReadonlyMap<string, Uint8Array> {
    return _tileBuffers;
  },

  get dirty(): ReadonlySet<string> {
    return _dirty;
  },

  get mode(): "add" | "remove" {
    return _mode;
  },

  /**
   * Subscribe to session state changes.  The callback is called on every
   * mutation (markDirty, ensureTileBuffer, beginSession, reset).
   * Returns an unsubscribe function.
   */
  onChange(fn: () => void): () => void {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },

  // ── Mutators ─────────────────────────────────────────────────────────

  /**
   * Begin or continue a session for the given annotation.
   *
   * When `annotationId` is a real, non-null ID, the session continues if the
   * ID matches the current session — multiple brush strokes on the same
   * existing annotation accumulate.
   *
   * When `annotationId` is `undefined` (a brand-new not-yet-created mask),
   * the session ALWAYS starts fresh unless `continuePending: true` is
   * explicitly passed and the current session is also `undefined` (i.e. the
   * caller knows this is still the same pending new-mask attempt).  This
   * prevents buffer bleeding between unrelated new-mask attempts that both
   * happen to have no id yet.
   */
  beginSession(annotationId: string | undefined, options?: { continuePending?: boolean }): void {
    const isContinuation = annotationId !== undefined
      ? _annotationId === annotationId
      : options?.continuePending === true && _annotationId === undefined;
    if (isContinuation) return;
    _annotationId = annotationId;
    _tileBuffers = new Map();
    _dirty = new Set();
    _tileVersions.clear();
    notify();
  },

  /**
   * Set the paint mode.
   */
  setMode(mode: "add" | "remove"): void {
    _mode = mode;
  },

  /**
   * Ensure a buffer exists for the given tile coordinate, hydrating from
   * existing shape data if available.
   *
   * @param col Tile column
   * @param row Tile row
   * @param existingRle Optional RLE data from the backend for this tile
   * @returns The buffer for this tile
   */
  ensureTileBuffer(col: number, row: number, existingRle?: string): Uint8Array {
    const key = `${col}:${row}`;
    let buf = _tileBuffers.get(key);

    if (!buf) {
      buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);

      if (existingRle) {
        const decoded = decode(existingRle, MASK_TILE_SIZE, MASK_TILE_SIZE);
        buf.set(decoded);
      }

      _tileBuffers.set(key, buf);
      _tileVersions.set(key, 0);
      notify();
    }

    return buf;
  },

  /**
   * Mark a tile as dirty (modified during this gesture).
   */
  markDirty(col: number, row: number): void {
    const key = `${col}:${row}`;
    if (!_dirty.has(key)) {
      _dirty.add(key);
    }
    // Increment the per-tile version so the renderer knows to re-rasterize
    const tileVer = (_tileVersions.get(key) ?? 0) + 1;
    _tileVersions.set(key, tileVer);
    notify();
  },

  /**
   * Get the per-tile version for a tile key.
   * Used by the renderer to determine if a session tile bitmap needs
   * re-rasterization.
   */
  getTileVersion(key: string): number {
    return _tileVersions.get(key) ?? -1;
  },

  /**
   * Get the buffer for a tile, if it exists.
   */
  getTileBuffer(col: number, row: number): Uint8Array | undefined {
    return _tileBuffers.get(`${col}:${row}`);
  },

  /**
   * Get the dirty tile keys as "col:row" strings.
   */
  getDirtyTiles(): string[] {
    return Array.from(_dirty);
  },

  /**
   * Discard the current session (gesture cancellation).
   * Leaves no residual state for the next gesture.
   */
  reset(): void {
    _annotationId = undefined;
    _tileBuffers = new Map();
    _dirty = new Set();
    _tileVersions.clear();
    notify();
    // Don't reset _mode — it's a persistent user preference, not session state
  },
};