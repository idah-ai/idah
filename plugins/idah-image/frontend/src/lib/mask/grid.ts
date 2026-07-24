// ---------------------------------------------------------------------------
// Grid math — tile coordinate utilities
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";

/**
 * Return the tile key string for a given column and row.
 */
export function tileKey(col: number, row: number): string {
  return `tile-${col}x${row}`;
}

/**
 * Return which tile a pixel coordinate belongs to.
 */
export function tileAt(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / MASK_TILE_SIZE),
    row: Math.floor(y / MASK_TILE_SIZE),
  };
}

/**
 * Return all tiles a circle overlaps.
 * Uses bounding-box approximation for tile overlap.
 */
export function tilesTouchedByCircle(
  cx: number,
  cy: number,
  radius: number,
): { col: number; row: number }[] {
  const minCol = Math.max(0, Math.floor((cx - radius) / MASK_TILE_SIZE));
  const maxCol = Math.floor((cx + radius) / MASK_TILE_SIZE);
  const minRow = Math.max(0, Math.floor((cy - radius) / MASK_TILE_SIZE));
  const maxRow = Math.floor((cy + radius) / MASK_TILE_SIZE);

  const tiles: { col: number; row: number }[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      tiles.push({ col, row });
    }
  }
  return tiles;
}

/**
 * Return all tiles a polygon overlaps.
 * Uses bounding-box approximation for tile overlap.
 */
export function tilesTouchedByPolygon(
  points: [number, number][],
): { col: number; row: number }[] {
  if (points.length === 0) return [];

  let minX = points[0][0];
  let maxX = points[0][0];
  let minY = points[0][1];
  let maxY = points[0][1];

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const minCol = Math.max(0, Math.floor(minX / MASK_TILE_SIZE));
  const maxCol = Math.floor(maxX / MASK_TILE_SIZE);
  const minRow = Math.max(0, Math.floor(minY / MASK_TILE_SIZE));
  const maxRow = Math.floor(maxY / MASK_TILE_SIZE);

  const tiles: { col: number; row: number }[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      tiles.push({ col, row });
    }
  }
  return tiles;
}
