// ---------------------------------------------------------------------------
// coverage-mask-session.ts — Tile buffer session for coverage mask
//
// Holds per-tile pixel buffers (Uint8Array, 128x128), tracks dirty tiles,
// provides direct rect painting (add/remove), snapshot undo support, and
// an onChange callback for canvas rendering.
//
// Patterned after mask-session.svelte.ts.
// ---------------------------------------------------------------------------
import { MASK_TILE_SIZE } from "./constants";
import { encode, decode } from "./rle";
import { isEmpty, fillPolygon } from "./raster";
import { tilesTouchedByPolygon } from "./grid";

// ── Internal state ───────────────────────────────────────────────────────

const _tileBuffers = new Map<string, Uint8Array>();
const _dirty = new Set<string>();
const _listeners = new Set<() => void>();

/**
 * Per-tile version, bumped whenever a tile's buffer changes. The canvas uses
 * it to re-rasterize only the tiles that changed since the last frame.
 */
const _versions = new Map<string, number>();

/**
 * The stored RLE each tile was last loaded from. Lets initFromRle skip tiles
 * whose stored value did not change (e.g. a reload triggered by an unrelated
 * annotation edit, or by this client's own flush).
 */
const _sourceRle = new Map<string, string>();

let _mode: "add" | "remove" = "add";

function bump(key: string): void {
  _versions.set(key, (_versions.get(key) ?? 0) + 1);
}

function notify(): void {
  for (const fn of _listeners) fn();
}

function rectToPolygon(x: number, y: number, w: number, h: number): [number, number][] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// ── Public API ───────────────────────────────────────────────────────────

export interface CoverageMaskSession {
  mode: "add" | "remove";
  onChange(fn: () => void): () => void;
  getTileBuffer(col: number, row: number): Uint8Array | undefined;
  getDirtyTiles(): string[];
  initFromRle(rleMap: Record<string, unknown>): void;
  fillRect(x: number, y: number, w: number, h: number, mode: "add" | "remove"): void;
  snapshotTiles(x: number, y: number, w: number, h: number): Array<{ key: string; rle: string }>;
  snapshotAll(): Array<{ key: string; rle: string }>;
  restoreSnapshots(snapshots: Array<{ key: string; rle: string }>): void;
  reset(): void;
  tileKeys(): IterableIterator<string>;
  getTileVersion(key: string): number;
  getAllTileEntries(): Array<{ col: number; row: number; rle: string }>;
  buildFlushEntries(): Array<{ key: string; value: object | null }>;
  triggerRedraw(): void;
}

export const session: CoverageMaskSession = {
  // ── Read-only ───────────────────────────────────────────────────────

  get mode(): "add" | "remove" { return _mode; },
  set mode(m: "add" | "remove") { _mode = m; },

  onChange(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  getTileBuffer(col: number, row: number): Uint8Array | undefined {
    return _tileBuffers.get(`${col}:${row}`);
  },

  getDirtyTiles(): string[] {
    return [..._dirty];
  },

  // ── Mutators ────────────────────────────────────────────────────────

  /**
   * Sync buffers with annotation tile data. Afterwards the session matches the
   * stored tiles exactly and nothing is dirty. Tiles whose stored RLE is
   * unchanged since they were last loaded (and that have no local edits) are
   * kept as-is, so an unrelated reload decodes and redraws nothing.
   */
  initFromRle(rleMap: Record<string, unknown>): void {
    const incoming = new Map<string, string>();
    for (const [key, value] of Object.entries(rleMap)) {
      const match = key.match(/^tile-(\d+)x(\d+)$/);
      if (!match) continue;
      if (!value || typeof value !== "object") continue;
      const rle = (value as Record<string, unknown>).rle;
      if (typeof rle !== "string") continue;
      incoming.set(`${parseInt(match[1], 10)}:${parseInt(match[2], 10)}`, rle);
    }

    let changed = false;
    // Drop tiles that are no longer stored
    for (const key of [..._tileBuffers.keys()]) {
      if (!incoming.has(key)) {
        _tileBuffers.delete(key);
        _sourceRle.delete(key);
        bump(key);
        changed = true;
      }
    }
    // Load new or changed tiles; keep untouched ones
    for (const [key, rle] of incoming) {
      if (_tileBuffers.has(key) && _sourceRle.get(key) === rle && !_dirty.has(key)) continue;
      _tileBuffers.set(key, decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE));
      _sourceRle.set(key, rle);
      bump(key);
      changed = true;
    }
    if (_dirty.size > 0) changed = true;
    _dirty.clear();
    if (changed) notify();
  },

  /** Paint or erase a rectangle into the tile buffers. */
  fillRect(x: number, y: number, w: number, h: number, mode: "add" | "remove"): void {
    const poly = rectToPolygon(x, y, w, h);
    const touched = tilesTouchedByPolygon(poly);
    for (const { col, row } of touched) {
      const key = `${col}:${row}`;
      let buf = _tileBuffers.get(key);
      if (!buf) {
        buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
        _tileBuffers.set(key, buf);
      }
      const originX = col * MASK_TILE_SIZE;
      const originY = row * MASK_TILE_SIZE;
      fillPolygon(buf, originX, originY, poly, mode);
      if (!_dirty.has(key)) _dirty.add(key);
      bump(key);
    }
    notify();
  },

  /** Capture current tile state for a rect (for undo snapshots). */
  snapshotTiles(x: number, y: number, w: number, h: number): Array<{ key: string; rle: string }> {
    const poly = rectToPolygon(x, y, w, h);
    const touched = tilesTouchedByPolygon(poly);
    const snapshots: Array<{ key: string; rle: string }> = [];
    for (const { col, row } of touched) {
      const key = `${col}:${row}`;
      const buf = _tileBuffers.get(key);
      snapshots.push({ key, rle: buf ? encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE) : "" });
    }
    return snapshots;
  },

  /** Capture ALL tiles (for clear undo). */
  snapshotAll(): Array<{ key: string; rle: string }> {
    const snapshots: Array<{ key: string; rle: string }> = [];
    for (const [key, buf] of _tileBuffers) {
      snapshots.push({ key, rle: encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE) });
    }
    return snapshots;
  },

  /** Restore tile buffers from snapshots (undo). Tiles are marked dirty. */
  restoreSnapshots(snapshots: Array<{ key: string; rle: string }>): void {
    for (const { key, rle } of snapshots) {
      _dirty.add(key);
      bump(key);
      if (rle === "") {
        _tileBuffers.delete(key);
      } else {
        const buf = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
        _tileBuffers.set(key, buf);
      }
    }
    notify();
  },

  /** Discard all state. */
  reset(): void {
    for (const key of _tileBuffers.keys()) bump(key);
    _tileBuffers.clear();
    _sourceRle.clear();
    _dirty.clear();
    notify();
  },

  /** Tile keys ("col:row") currently held in the session. */
  tileKeys(): IterableIterator<string> {
    return _tileBuffers.keys();
  },

  /** Version of a tile's buffer; changes whenever its pixels change. */
  getTileVersion(key: string): number {
    return _versions.get(key) ?? 0;
  },

  /** Get tile RLE data for canvas rendering. */
  getAllTileEntries(): Array<{ col: number; row: number; rle: string }> {
    const entries: Array<{ col: number; row: number; rle: string }> = [];
    for (const [key, buf] of _tileBuffers) {
      if (isEmpty(buf)) continue;
      const [colStr, rowStr] = key.split(":");
      entries.push({
        col: parseInt(colStr, 10),
        row: parseInt(rowStr, 10),
        rle: encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE),
      });
    }
    return entries;
  },

  /** Trigger a redraw notification (used by Show/Hide toggle). */
  triggerRedraw(): void {
    notify();
  },

  /** Build flush entries from dirty tiles. */
  buildFlushEntries(): Array<{ key: string; value: object | null }> {
    const entries: Array<{ key: string; value: object | null }> = [];
    for (const tileKey of _dirty) {
      const [colStr, rowStr] = tileKey.split(":");
      const buf = _tileBuffers.get(tileKey);
      const tKey = `tile-${colStr}x${rowStr}`;
      entries.push({ key: tKey, value: (!buf || isEmpty(buf)) ? null : { rle: encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE) } });
    }
    _dirty.clear();
    return entries;
  },
};
