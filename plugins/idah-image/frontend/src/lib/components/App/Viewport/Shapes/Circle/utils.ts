// ---------------------------------------------------------------------------
// Circle utils — handle positions, hit testing
// ---------------------------------------------------------------------------
import { distance, type Point } from "$lib/utils/math/point";

/**
 * Distance in pixels from a normalized point to the circle's circumference.
 */
export function pointToCircleEdgeDistance(
  point: Point,
  center: Point,
  radius: number,
  w: number,
  h: number,
): number {
  const scale = Math.min(w, h);
  const centerPx: Point = [center[0] * w, center[1] * h];
  const pointPx: Point = [point[0] * w, point[1] * h];
  const dist = distance(centerPx, pointPx);
  const radiusPx = radius * scale;
  return Math.abs(dist - radiusPx);
}

/**
 * Test if a normalized cursor is within hitRadiusPx of the circle's edge.
 */
export function hitTestCircleEdge(
  point: Point,
  center: Point,
  radius: number,
  w: number,
  h: number,
  hitRadiusPx: number,
  viewportScale: number = 1,
): boolean {
  const distPx = pointToCircleEdgeDistance(point, center, radius, w, h);
  return distPx * viewportScale < hitRadiusPx;
}

/**
 * Test if a normalized cursor is inside the circle's body (for panning).
 */
export function pointInCircle(
  point: Point,
  center: Point,
  radius: number,
  w: number,
  h: number,
): boolean {
  const scale = Math.min(w, h);
  const centerPx: Point = [center[0] * w, center[1] * h];
  const pointPx: Point = [point[0] * w, point[1] * h];
  const dist = distance(centerPx, pointPx);
  const radiusPx = radius * scale;
  return dist <= radiusPx;
}

/**
 * Get the edge handle position at angle 0 (right side of circle).
 * Returns normalized coordinates.
 */
export function circleEdgeHandle(center: Point, radius: number): Point {
  return [center[0] + radius, center[1]];
}

/**
 * Compute the angle in radians from center to a normalized point.
 */
export function angleFromCenter(center: Point, point: Point): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

/**
 * Get a point on the circle's edge at a given angle.
 */
export function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}
