export const MASK_TILE_SIZE = 128;

// ── Color palette for mask categories ────────────────────────────────────

/**
 * Color palette for mask categories (indexed by category index).
 * Each entry is [r, g, b, a] where a is the fill opacity (0-255).
 */
export const MASK_COLORS: [number, number, number, number][] = [
  [255, 0, 0, 100],
  [0, 150, 255, 100],
  [0, 200, 50, 100],
  [255, 200, 0, 100],
  [200, 0, 255, 100],
  [255, 100, 0, 100],
  [0, 200, 200, 100],
  [255, 0, 100, 100],
];

/**
 * Base alpha for non-selected committed masks (faint).
 * Out of 255.
 */
export const COMMIT_ALPHA = 100;

/**
 * Alpha for selected masks and in-progress session buffers (more visible).
 * Out of 255.
 */
export const HIGHLIGHT_ALPHA = 140;
