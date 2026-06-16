// ---------------------------------------------------------------------------
// math/bbox.ts — Bounding box mathematics
// ---------------------------------------------------------------------------

import type { Point } from "$lib/utils/math/point";
import { centroid, rotatePoint } from "$lib/utils/math/point";

/** AABB: [x1, y1, x2, y2] in normalized space. */
export type BBox = [number, number, number, number];

/** Convert a BBox to 4 corner points in [tl, tr, br, bl] order. */
export function bboxToPoints(bbox: BBox): Point[] {
  const [x1, y1, x2, y2] = bbox;
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

/** Normalize 4 points to canonical order [tl, tr, br, bl]. */
export function normalizeRect(pts: Point[]): Point[] {
  if (pts.length !== 4) return pts;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
}

/** Interpolate between two AABBs by a ratio t (0-1). */
export function interpolateBBox(a: BBox, b: BBox, t: number): BBox {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/** Linearly interpolate an angle (radians) without wrap-around (supports revolutions). */
export function interpolateAngle(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
