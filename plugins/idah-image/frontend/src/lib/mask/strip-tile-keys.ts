// ---------------------------------------------------------------------------
// strip-tile-keys.ts — Tile key detection and stripping helpers
//
// Tile keys follow the naming convention "tile-{col}x{row}" and are produced
// by the mask plugin's grid.ts, rle.ts, and raster.ts modules. These keys
// must never be persisted into the parent annotations.dimensions jsonb column
// — they are stored in the normalized annotation_shape child table via
// setShape/setShapes.
//
// The helpers in this file are used by commands that need to strip tile keys
// from a shape object before passing it to create() or update(), and then
// restore them via setShape/setShapes.
// ---------------------------------------------------------------------------

/**
 * Check if a key is a tile key (tile-{col}x{row}).
 */
export function isTileKey(key: string): boolean {
  return /^tile-\d+x\d+$/.test(key);
}

/**
 * Return a copy of `shape` with all tile-* keys removed.
 * The original object is not mutated.
 */
export function stripTileKeys<T extends Record<string, unknown>>(shape: T): T {
  const result = { ...shape };
  for (const key of Object.keys(result)) {
    if (isTileKey(key)) {
      delete result[key];
    }
  }
  return result;
}

/**
 * Extract tile entries from `shape` — returns an array of { key, value }
 * for every tile-* key found. Non-tile keys are left untouched.
 */
export function extractTileEntries(shape: Record<string, unknown>): Array<{ key: string; value: object }> {
  const entries: Array<{ key: string; value: object }> = [];
  for (const key of Object.keys(shape)) {
    if (isTileKey(key)) {
      const val = shape[key];
      if (val && typeof val === 'object') {
        entries.push({ key, value: val as object });
      }
    }
  }
  return entries;
}