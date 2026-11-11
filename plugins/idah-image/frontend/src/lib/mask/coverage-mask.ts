// ---------------------------------------------------------------------------
// coverage-mask.ts — Coverage mask tile utilities
//
// Converts coverage mask bounding boxes to pixel mask tiles (tile-{col}x{row})
// that can be stored via setShape / setShapes.
//
// Reuses the existing raster (fillPolygon) and grid (tilesTouchedByPolygon)
// utilities from the IMAGE_MASK tile system.
// ---------------------------------------------------------------------------
import { MASK_TILE_SIZE } from "./constants";
import { encode } from "./rle";
import { isEmpty, fillPolygon } from "./raster";
import { tilesTouchedByPolygon } from "./grid";

/** Convert a [x, y, w, h] rect to a polygon point array. */
function rectToPolygon(x: number, y: number, w: number, h: number): [number, number][] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Collect all touched tile keys ("col:row") for a set of rects. */
function collectTouchedKeys(rects: number[][]): Set<string> {
  const keys = new Set<string>();
  for (const [x, y, w, h] of rects) {
    for (const { col, row } of tilesTouchedByPolygon(rectToPolygon(x, y, w, h))) {
      keys.add(`${col}:${row}`);
    }
  }
  return keys;
}

/**
 * Build tile entries for a set of rects.
 *
 * Paints each rect into 128×128 tile buffers, RLE-encodes non-empty tiles,
 * and optionally includes delete entries for stale tiles.
 *
 * @param rects          Current coverage mask rects [[x, y, w, h], …]
 * @param existingTileKeys Optional set of previously-stored tile keys ("col:row")
 *                        — tiles present here but not in the current rects are
 *                        emitted as delete entries (value: null)
 * @returns Entries ready for setShape/setShapes
 */
export function buildTileEntries(
  rects: number[][],
  existingTileKeys?: Set<string>,
): Array<{ key: string; value: object | null }> {
  const touchedKeys = collectTouchedKeys(rects);
  const entries: Array<{ key: string; value: object | null }> = [];

  // Delete stale tiles that are no longer touched
  if (existingTileKeys) {
    for (const key of existingTileKeys) {
      if (!touchedKeys.has(key)) {
        const [colStr, rowStr] = key.split(":");
        entries.push({ key: `tile-${colStr}x${rowStr}`, value: null });
      }
    }
  }

  // Upsert current tiles
  for (const tileKey of touchedKeys) {
    const [colStr, rowStr] = tileKey.split(":");
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);
    const buffer = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    const originX = col * MASK_TILE_SIZE;
    const originY = row * MASK_TILE_SIZE;

    for (const [x, y, w, h] of rects) {
      fillPolygon(buffer, originX, originY, rectToPolygon(x, y, w, h), "add");
    }

    if (isEmpty(buffer)) {
      entries.push({ key: `tile-${col}x${row}`, value: null });
    } else {
      const rle = encode(buffer, MASK_TILE_SIZE, MASK_TILE_SIZE);
      entries.push({ key: `tile-${col}x${row}`, value: { rle } });
    }
  }

  return entries;
}



/** Coverage mask shape: a bbox with [x, y, w, h] points. */
export interface CoverageMaskShape {
  type: string;
  points: number[];
}

/**
 * Clamp a rectangle to media bounds.
 * Returns [clampedX, clampedY, clampedW, clampedH].
 */
export function clampRect(
  x: number, y: number, w: number, h: number,
  mediaWidth: number, mediaHeight: number,
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(x, mediaWidth));
  const clampedY = Math.max(0, Math.min(y, mediaHeight));
  const clampedW = Math.min(w, mediaWidth - clampedX);
  const clampedH = Math.min(h, mediaHeight - clampedY);
  return [clampedX, clampedY, Math.max(0, clampedW), Math.max(0, clampedH)];
}

/**
 * Subtract an eraser rectangle from a list of coverage mask shapes.
 * Returns a new list with the eraser area removed (shapes may be split
 * into up to 4 pieces).
 */
export function subtractRectFromShapes(
  shapes: CoverageMaskShape[],
  eraserX: number, eraserY: number, eraserW: number, eraserH: number,
): CoverageMaskShape[] {
  const result: CoverageMaskShape[] = [];
  for (const sh of shapes) {
    if (sh.type !== "bbox" || sh.points.length < 4) {
      result.push(sh);
      continue;
    }
    const [sx, sy, sw, sh2] = sh.points;
    // No overlap → keep entire shape
    if (eraserX >= sx + sw || eraserX + eraserW <= sx || eraserY >= sy + sh2 || eraserY + eraserH <= sy) {
      result.push(sh);
      continue;
    }
    // Complete coverage → remove entirely
    if (eraserX <= sx && eraserY <= sy && eraserX + eraserW >= sx + sw && eraserY + eraserH >= sy + sh2) {
      continue;
    }
    // Partial overlap — split into remaining rectangles around the erase area
    const ex2 = eraserX + eraserW,
      ey2 = eraserY + eraserH;
    const sx2 = sx + sw,
      sy2 = sy + sh2;
    // Top
    if (eraserY > sy) result.push({ type: "bbox", points: [sx, sy, sw, eraserY - sy] });
    // Bottom
    if (ey2 < sy2) result.push({ type: "bbox", points: [sx, ey2, sw, sy2 - ey2] });
    // Left (between the top/bottom of the erase rect)
    if (eraserX > sx)
      result.push({ type: "bbox", points: [sx, Math.max(sy, eraserY), eraserX - sx, Math.min(sy2, ey2) - Math.max(sy, eraserY)] });
    // Right
    if (ex2 < sx2)
      result.push({
        type: "bbox",
        points: [ex2, Math.max(sy, eraserY), sx2 - ex2, Math.min(sy2, ey2) - Math.max(sy, eraserY)],
      });
  }
  return result;
}