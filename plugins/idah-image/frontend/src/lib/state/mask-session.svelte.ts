// ---------------------------------------------------------------------------
// mask-session.svelte.ts — In-memory, per-gesture mask paint state
//
// Tracks the current mask annotation that is being painted, the per-tile
// pixel buffers, which tiles have been modified (dirty set), and the
// current add/remove mode.
//
// One session per gesture. Hydrates from existing shape data on first
// touch of a tile. Discarded via `reset()` on gesture cancellation.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { decode } from "$lib/mask/rle";
import { tileKey } from "$lib/mask/grid";

// ─── Session state ───────────────────────────────────────────────────────

let _annotationId: string | undefined = $state(undefined);

/**
 * Per-tile pixel buffers. Keyed by `"col:row"` (numeric, for fast lookup).
 * Each buffer is a flat Uint8Array of size MASK_TILE_SIZE × MASK_TILE_SIZE.
 */
let _tileBuffers: Map<string, Uint8Array> = $state.raw(new Map());

/**
 * Set of tile keys that have been modified during this gesture.
 */
let _dirty: Set<string> = $state.raw(new Set());

/**
 * Current paint mode — "add" paints pixels, "remove" erases them.
 */
let _mode: "add" | "remove" = $state("add");

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

  // ── Mutators ─────────────────────────────────────────────────────────

  /**
   * Begin or continue a session for the given annotation.
   * Preserves existing buffers if the annotation ID is the same, so
   * multiple strokes on the same annotation accumulate rather than
   * replacing each other. Only resets fully on explicit `reset()`.
   */
  beginSession(annotationId: string | undefined): void {
    // If continuing the same annotation, keep the buffers and dirty set.
    // This allows multiple brush strokes to accumulate before the
    // annotation is created or the session is explicitly cancelled.
    if (_annotationId === annotationId) {
      return;
    }
    _annotationId = annotationId;
    _tileBuffers = new Map();
    _dirty = new Set();
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

      _tileBuffers = new Map(_tileBuffers).set(key, buf);
    }

    return buf;
  },

  /**
   * Mark a tile as dirty (modified during this gesture).
   */
  markDirty(col: number, row: number): void {
    const key = `${col}:${row}`;
    _dirty = new Set(_dirty).add(key);
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
    // Don't reset _mode — it's a persistent user preference, not session state
  },
};
