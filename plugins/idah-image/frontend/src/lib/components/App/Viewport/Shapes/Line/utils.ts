// ---------------------------------------------------------------------------
// Line utils — handle positions, hit testing
// ---------------------------------------------------------------------------
import { distance, midpoint, type Point } from "$lib/utils/math/point";

/** Generate handle positions: [midpoint] for panning. Endpoints are handled separately. */
export function lineMidpoint(pts: Point[]): Point | undefined {
  if (pts.length < 2) return undefined;
  return midpoint(pts[0], pts[1]);
}

/**
 * Compute the perpendicular distance from a point to a line segment.
 */
export function pointToLineDistance(point: Point, a: Point, b: Point): number {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const ap = [point[0] - a[0], point[1] - a[1]];
  const abLenSq = ab[0] * ab[0] + ab[1] * ab[1];
  if (abLenSq === 0) return distance(point, a);
  let t = (ap[0] * ab[0] + ap[1] * ab[1]) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a[0] + t * ab[0];
  const projY = a[1] + t * ab[1];
  return distance(point, [projX, projY]);
}

/**
 * Test if a normalized cursor is within hitRadiusPx of the line segment.
 * Uses the perpendicular distance from the point to the segment.
 */
export function hitTestLine(
  point: Point,
  pts: Point[],
  w: number,
  h: number,
  hitRadiusPx: number,
  viewportScale: number = 1,
): boolean {
  if (pts.length < 2) return false;
  const distNorm = pointToLineDistance(point, pts[0], pts[1]);
  const distPx = distNorm * Math.min(w, h) * viewportScale;
  return distPx < hitRadiusPx;
}
