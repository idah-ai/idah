// ---------------------------------------------------------------------------
// coverage-mask.ts — Coverage mask tile utilities
//
// Converts coverage mask bounding boxes to pixel mask tiles (tile-{col}x{row})
// that can be stored via setShape / setShapes.
//
// Reuses the existing raster (fillPolygon) and grid (tilesTouchedByPolygon)
// utilities from the IMAGE_MASK tile system.
// ---------------------------------------------------------------------------

/** Coverage mask shape: a bbox with [x, y, w, h] points. */
export interface CoverageMaskShape {
  type: string;
  points: number[];
}

/**
 * Clip a rectangle to media bounds: the part of [x, y, w, h] that lies inside
 * [0, 0, mediaWidth, mediaHeight]. Both corners are clamped, so a rect that
 * starts outside the image loses the outside part rather than shifting inward.
 * Returns [clampedX, clampedY, clampedW, clampedH]; a rect fully outside the
 * image comes back with zero width or height.
 */
export function clampRect(
  x: number, y: number, w: number, h: number,
  mediaWidth: number, mediaHeight: number,
): [number, number, number, number] {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  const x1 = clamp(x, mediaWidth);
  const y1 = clamp(y, mediaHeight);
  const x2 = clamp(x + w, mediaWidth);
  const y2 = clamp(y + h, mediaHeight);
  return [x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1)];
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
