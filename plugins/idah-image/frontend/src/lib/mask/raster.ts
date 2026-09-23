// ---------------------------------------------------------------------------
// Raster operations — per-tile buffer painting
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";

/**
 * Paint a circle into a tile buffer.
 * The buffer is a flat Uint8Array of size MASK_TILE_SIZE * MASK_TILE_SIZE (row-major).
 * tileOriginX/Y are the image-pixel coordinates of the tile's top-left corner.
 *
 * Clips to mediaWidth/mediaHeight to prevent painting outside the image bounds.
 */
export function paintCircle(
  buffer: Uint8Array,
  tileOriginX: number,
  tileOriginY: number,
  cx: number,
  cy: number,
  radius: number,
  mode: "add" | "remove",
  mediaWidth: number = Infinity,
  mediaHeight: number = Infinity,
  /** Optional callback: if it returns true, the pixel is occupied by another mask and should be skipped (add mode only). */
  checkOccupied?: (localPx: number, localPy: number) => boolean,
): void {
  const tileW = MASK_TILE_SIZE;
  const tileH = buffer.length / tileW;

  const maxPx = Math.min(tileW, mediaWidth - tileOriginX);
  const maxPy = Math.min(tileH, mediaHeight - tileOriginY);

  for (let py = 0; py < maxPy; py++) {
    for (let px = 0; px < maxPx; px++) {
      const imgX = tileOriginX + px + 0.5;
      const imgY = tileOriginY + py + 0.5;
      const dx = imgX - cx;
      const dy = imgY - cy;
      const inside = dx * dx + dy * dy <= radius * radius;

      if (inside) {
        // Skip if pixel is occupied by another mask (only in add mode)
        if (mode === "add" && checkOccupied?.(px, py)) continue;
        const idx = py * tileW + px;
        if (mode === "add") {
          buffer[idx] = 1;
        } else {
          buffer[idx] = 0;
        }
      }
    }
  }
}

/**
 * Fill a polygon into a tile buffer using a simple scanline algorithm.
 */
export function fillPolygon(
  buffer: Uint8Array,
  tileOriginX: number,
  tileOriginY: number,
  points: [number, number][],
  mode: "add" | "remove",
  mediaWidth: number = Infinity,
  mediaHeight: number = Infinity,
  /** Optional callback: if it returns true, the pixel is occupied by another mask and should be skipped (add mode only). */
  checkOccupied?: (localPx: number, localPy: number) => boolean,
): boolean {
  if (points.length < 3) return false;
  let painted = false;

  const tileW = MASK_TILE_SIZE;
  const tileH = buffer.length / tileW;

  const maxPx = Math.min(tileW, mediaWidth - tileOriginX);
  const maxPy = Math.min(tileH, mediaHeight - tileOriginY);

  for (let py = 0; py < maxPy; py++) {
    const imgY = tileOriginY + py + 0.5;

    // Find intersections of scanline with polygon edges
    const intersections: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const [x1, y1] = points[i];
      const [x2, y2] = points[j];

      // Check if scanline crosses this edge
      if ((y1 <= imgY && y2 > imgY) || (y2 <= imgY && y1 > imgY)) {
        const t = (imgY - y1) / (y2 - y1);
        const ix = x1 + t * (x2 - x1);
        intersections.push(ix);
      }
    }

    intersections.sort((a, b) => a - b);

    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const startX = Math.max(tileOriginX, Math.ceil(intersections[k]));
      const endX = Math.min(tileOriginX + tileW - 1, Math.floor(intersections[k + 1]));

      for (let px = startX; px <= endX; px++) {
        const localPx = px - tileOriginX;
        // Skip if pixel is occupied by another mask (only in add mode)
        if (mode === "add" && checkOccupied?.(localPx, py)) continue;
        const idx = py * tileW + (px - tileOriginX);
        if (idx >= 0 && idx < buffer.length) {
          if (mode === "add") {
            buffer[idx] = 1;
          } else {
            buffer[idx] = 0;
          }
          painted = true;
        }
      }
    }
  }
  return painted;
}

/**
 * Check if a tile buffer is empty (all zeros).
 */
export function isEmpty(buffer: Uint8Array): boolean {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== 0) return false;
  }
  return true;
}
