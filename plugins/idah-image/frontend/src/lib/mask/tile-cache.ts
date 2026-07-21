// ---------------------------------------------------------------------------
// tile-cache.ts — Shared decode cache for mask tile rendering
//
// Caches decoded RLE buffers and their rendered offscreen bitmaps so that
// all three decode call sites (canvas redraw, click hit-test, hover hit-test)
// share the same decoded data instead of decoding independently.
//
// Cache entries are keyed by "annotationId:tileKey:colorKey" so that the same
// tile rendered with different alpha values (e.g. selected vs unselected) gets
// separate cached entries.  The color key is a 4-byte hex string of the RGBA
// values, so any color change invalidates the cache lookup.
//
// The offscreen canvas uses nearest-neighbor interpolation (imageSmoothingEnabled
// = false) to keep mask pixels sharp when the bitmap is composited onto a
// zoomed-in main canvas.  The main canvas can still apply its own smoothing
// setting independently when drawing the full scene.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { decode } from "$lib/mask/rle";

interface CacheEntry {
  /** The RLE string that was decoded to produce this entry. */
  sourceRle: string;
  /** Decoded pixel buffer (used for hit-testing). */
  buffer: Uint8Array;
  /** Pre-rendered offscreen bitmap (used for compositing). */
  bitmap: ImageBitmap;
}

const _cache = new Map<string, CacheEntry>();

/**
 * Build a colour key string from an RGBA tuple so different alpha values
 * produce different cache keys.
 */
function colorKey(color: [number, number, number, number]): string {
  return `${color[0]},${color[1]},${color[2]},${color[3]}`;
}

/**
 * Get or create a cached tile entry.
 *
 * @param annotationId The annotation this tile belongs to
 * @param tileKey The tile key in "col:row" format
 * @param rle The RLE-encoded tile data
 * @param color The RGBA color to render the tile with
 * @returns The cached { buffer, bitmap }
 */
export function getOrCreate(
  annotationId: string,
  tileKey: string,
  rle: string,
  color: [number, number, number, number],
): { buffer: Uint8Array; bitmap: ImageBitmap } {
  const cacheKey = `${annotationId}:${tileKey}:${colorKey(color)}`;
  const existing = _cache.get(cacheKey);

  // Return cached entry if source RLE AND colour match
  if (existing && existing.sourceRle === rle) {
    return { buffer: existing.buffer, bitmap: existing.bitmap };
  }

  // Decode the RLE
  const buffer = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);

  // Render to an offscreen canvas, then produce an ImageBitmap.
  // Use nearest-neighbour interpolation so the mask pixels stay sharp
  // when the bitmap is composited onto a zoomed-in main canvas.
  const offscreen = new OffscreenCanvas(MASK_TILE_SIZE, MASK_TILE_SIZE);
  const octx = offscreen.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  const [r, g, b, a] = color;
  octx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;

  // Only draw painted pixels
  for (let py = 0; py < MASK_TILE_SIZE; py++) {
    for (let px = 0; px < MASK_TILE_SIZE; px++) {
      if (buffer[py * MASK_TILE_SIZE + px] === 1) {
        octx.fillRect(px, py, 1, 1);
      }
    }
  }

  const bitmap = offscreen.transferToImageBitmap();

  const entry: CacheEntry = { sourceRle: rle, buffer, bitmap };
  _cache.set(cacheKey, entry);

  return { buffer: entry.buffer, bitmap: entry.bitmap };
}

/**
 * Invalidate a specific tile in the cache.
 * Call this whenever a tile's committed value changes (on flush success) or
 * is deleted, so the cache doesn't serve stale pixels.
 */
export function invalidate(annotationId: string, tileKey: string): void {
  const prefix = `${annotationId}:${tileKey}:`;
  for (const [key, entry] of _cache) {
    if (key.startsWith(prefix)) {
      entry.bitmap.close(); // Free GPU memory
      _cache.delete(key);
    }
  }
}

/**
 * Invalidate all tiles for a given annotation.
 * Call this when an annotation is deleted or when undo/redo restores
 * a prior state for multiple tiles at once.
 */
export function invalidateAll(annotationId: string): void {
  const prefix = `${annotationId}:`;
  for (const [key, entry] of _cache) {
    if (key.startsWith(prefix)) {
      entry.bitmap.close();
      _cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  for (const entry of _cache.values()) {
    entry.bitmap.close();
  }
  _cache.clear();
}
