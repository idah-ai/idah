// ---------------------------------------------------------------------------
// mask/occupancy.ts — Occupancy grid for preventing mask overlap
//
// Maintains a merged bitmap of all committed mask tiles. When preventOverlap
// is enabled, paint operations check this grid before adding pixels, so
// masks cannot overlap one another.
//
// The grid is rebuilt only when annotations change, tracked via a dirty
// flag.  Callers should call markDirty() on flush/load/undo/redo instead of
// rebuilding on every pointer down.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";
import { decode } from "./rle";
import { IMAGE_MASK } from "$lib/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";

/**
 * Occupancy grid: Map<"col:row", Uint8Array> where each buffer is a
 * MASK_TILE_SIZE × MASK_TILE_SIZE bitmap ORed from all committed masks.
 */
let _grid = new Map<string, Uint8Array>();

/**
 * Dirty flag — set to true whenever annotations have changed and the
 * grid needs to be rebuilt.  Cleared after rebuildOccupancy() is called.
 */
let _dirty = true;

/**
 * Mark the occupancy grid as dirty (needs rebuild).
 * Call this after flush, load, undo/redo, or any committed annotation change.
 */
export function markOccupancyDirty(): void {
  _dirty = true;
}

/**
 * Rebuild the occupancy grid from all committed mask annotations.
 * Skips the rebuild if the grid is already clean (no changes since last build).
 * Returns true if the grid was rebuilt, false if it was already up-to-date.
 */
export function rebuildOccupancy(annotations: AnnotationItem[]): boolean {
  if (!_dirty) {
    return false; // already up-to-date
  }
  _dirty = false;

  const grid = new Map<string, Uint8Array>();

  for (const ann of annotations) {
    // Skip hidden annotations — they shouldn't block painting
    if (annotation.isHidden(ann)) continue;

    const shape = ann.shape as Record<string, unknown>;
    if (shape?.type !== IMAGE_MASK) continue;

    for (const [key, val] of Object.entries(shape)) {
      if (!key.startsWith("tile-")) continue;
      const match = key.match(/^tile-(\d+)x(\d+)$/);
      if (!match) continue;
      const col = parseInt(match[1], 10);
      const row = parseInt(match[2], 10);
      const tileData = val as { rle?: string } | undefined;
      if (!tileData?.rle) continue;

      const buf = decode(tileData.rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
      const tileKey = `${col}:${row}`;
      const existing = grid.get(tileKey);
      if (existing) {
        // OR into existing grid tile
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] === 1) existing[i] = 1;
        }
      } else {
        grid.set(tileKey, buf);
      }
    }
  }

  _grid = grid;
  return true;
}

/**
 * Check if a specific pixel is occupied by any committed mask.
 */
export function isOccupied(col: number, row: number, localPx: number, localPy: number): boolean {
  const key = `${col}:${row}`;
  const occ = _grid.get(key);
  if (!occ) return false;
  const idx = localPy * MASK_TILE_SIZE + localPx;
  return occ[idx] === 1;
}
