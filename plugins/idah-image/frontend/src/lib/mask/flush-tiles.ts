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

/**
 * Flush dirty tiles to the backend.
 *
 * For each dirty tile key:
 *   - If the buffer is empty, send `null` to delete the tile row (idempotent).
 *   - Otherwise, encode the buffer as RLE and upsert it.
 *
 * @param annotationId The annotation to write tiles for
 * @param dirtyTiles Array of "col:row" tile keys that are dirty
 * @param getBuffer Function that returns the tile buffer for a given (col, row),
 *        or undefined if the tile no longer has data
 * @param setShape Function to call the backend (e.g. data.annotations.setShape)
 */
export async function flushDirtyTiles(
  annotationId: string,
  dirtyTiles: string[],
  getBuffer: (col: number, row: number) => Uint8Array | undefined,
  setShape: (annotationId: string, key: string, value: object | null) => Promise<void>,
): Promise<void> {
  for (const tileKey of dirtyTiles) {
    const [colStr, rowStr] = tileKey.split(":");
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);
    const buf = getBuffer(col, row);

    if (buf) {
      if (isEmpty(buf)) {
        // Send null to delete the tile row (idempotent)
        await setShape(annotationId, `tile-${col}x${row}`, null);
        // Free the cached bitmap for this tile — the tile no longer exists
        invalidate(annotationId, tileKey);
      } else {
        const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
        await setShape(annotationId, `tile-${col}x${row}`, { rle });
        // Invalidate the cached bitmap — the RLE value changed
        invalidate(annotationId, tileKey);
      }
    }
  }
}
