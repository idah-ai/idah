// ---------------------------------------------------------------------------
// canvas-render.ts — Canvas rendering utilities for mask tiles
//
// Renders committed and in-progress mask tiles onto an HTMLCanvasElement.
// Uses ctx.setTransform() with the same scale/translate values driving the
// SVG viewBox, so mask pixels align perfectly with the SVG shape layer.
//
// Rendering uses fillRect rather than putImageData because putImageData is
// unaffected by the current transform matrix — it always writes in pixel
// coordinates. fillRect respects the transform, so tiles automatically
// follow pan/zoom.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "$lib/mask/constants";

/**
 * Color palette for mask categories (indexed by category index).
 * Each entry is [r, g, b, a] where a is the fill opacity (0-255).
 *
 * Two variants per entry:
 *   - normal: faint, for non-selected committed masks
 *   - highlighted: more opaque, for selected or in-progress (session) masks
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

/**
 * Get a color for a category index, with the given alpha override.
 */
export function getMaskColor(index: number, alpha: number = COMMIT_ALPHA): [number, number, number, number] {
  const base = MASK_COLORS[index % MASK_COLORS.length];
  return [base[0], base[1], base[2], alpha];
}

/**
 * Apply alpha override to an existing [r,g,b,a] color.
 */
export function withAlpha(color: [number, number, number, number], alpha: number): [number, number, number, number] {
  return [color[0], color[1], color[2], alpha];
}

/**
 * Render a single decoded mask tile onto the canvas.
 * Uses fillRect for each painted pixel so transforms are respected.
 */
export function renderTile(
  ctx: CanvasRenderingContext2D,
  buffer: Uint8Array,
  col: number,
  row: number,
  color: [number, number, number, number],
): void {
  const tileX = col * MASK_TILE_SIZE;
  const tileY = row * MASK_TILE_SIZE;
  const [r, g, b, a] = color;

  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;

  // Only draw painted pixels — never fill the whole tile, because that
  // would overwrite other annotations' pixels in overlapping tiles.
  for (let py = 0; py < MASK_TILE_SIZE; py++) {
    for (let px = 0; px < MASK_TILE_SIZE; px++) {
      const bufIdx = py * MASK_TILE_SIZE + px;
      if (buffer[bufIdx] === 1) {
        ctx.fillRect(tileX + px, tileY + py, 1, 1);
      }
    }
  }
}

/**
 * Clear the canvas and re-render all tiles.
 */
export function renderTiles(
  ctx: CanvasRenderingContext2D,
  tiles: Map<string, Uint8Array>,
  colorIndex: number,
): void {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const color = getMaskColor(colorIndex);

  for (const [key, buffer] of tiles) {
    const [colStr, rowStr] = key.split(":");
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);
    renderTile(ctx, buffer, col, row, color);
  }
}

/**
 * Apply the viewport transform to the canvas context.
 */
export function applyViewportTransform(
  ctx: CanvasRenderingContext2D,
  scale: number,
  translateX: number,
  translateY: number,
): void {
  ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
}
