// ---------------------------------------------------------------------------
// flush-tiles.ts — Shared tile-write logic for mask annotations
//
// Factors out the "for each dirty tile: check if empty, encode RLE if not,
// call setShape" loop that was previously duplicated in both:
//   - commands/annotation/add.ts (first-time mask creation)
//   - commands/annotation/mask_shapes.flush.ts (edits to existing mask)
//
// Both commands call this function instead of duplicating the loop.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { encode } from "$lib/mask/rle";
import { isEmpty } from "$lib/mask/raster";
import { invalidate } from "$lib/mask/tile-cache";
import { writeTileEntries } from "$lib/mask/write-tile-entries";

/**
 * Flush dirty tiles to the backend.
 *
 * For each dirty tile key:
 *   - If the buffer is empty, send `null` to delete the tile row (idempotent).
 *   - Otherwise, encode the buffer as RLE and upsert it.
 *
 * When there are multiple dirty tiles, uses `setShapes` for a single IDB transaction
 * and a single store reset, rather than individual transactions per tile.
 *
 * @param annotationId The annotation to write tiles for
 * @param dirtyTiles Array of "col:row" tile keys that are dirty
 * @param getBuffer Function that returns the tile buffer for a given (col, row),
 *        or undefined if the tile no longer has data
 * @param setShape Function to call the backend (e.g. data.annotations.setShape)
 * @param setShapes Batched variant (e.g. data.annotations.setShapes) — used when
 *        multiple tiles are dirty. Falls back to sequential setShape calls if not provided.
 */
export async function flushDirtyTiles(
  annotationId: string,
  dirtyTiles: string[],
  getBuffer: (col: number, row: number) => Uint8Array | undefined,
  setShape: (annotationId: string, key: string, value: object | null) => Promise<void>,
  setShapes?: (annotationId: string, entries: Array<{ key: string; value: object | null }>) => Promise<void>,
): Promise<void> {
  // Build the entries array
  const entries: Array<{ key: string; value: object | null }> = [];
  for (const tileKey of dirtyTiles) {
    const [colStr, rowStr] = tileKey.split(":");
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);
    const buf = getBuffer(col, row);

    if (buf) {
      if (isEmpty(buf)) {
        entries.push({ key: `tile-${col}x${row}`, value: null });
        invalidate(annotationId, tileKey);
      } else {
        const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
        entries.push({ key: `tile-${col}x${row}`, value: { rle } });
        invalidate(annotationId, tileKey);
      }
    }
  }

  if (entries.length === 0) return;

  if (setShapes) {
    await writeTileEntries({ setShape, setShapes }, annotationId, entries);
  } else {
    // No batching available: fire all in parallel
    const pending: Promise<void>[] = [];
    for (const { key, value } of entries) {
      pending.push(setShape(annotationId, key, value));
    }
    await Promise.all(pending);
  }
}
