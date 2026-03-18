import { type Point } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

/**
 * Geometry and Math utility functions for polygon operations
 */

/**
 * Calculate the dot product of two 2D vectors
 */
export function dot(a: Point, b: Point): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Subtract two 2D points/vectors
 */
export function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}

/**
 * Add two 2D points/vectors
 */
export function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

/**
 * Scale a 2D vector by a scalar value
 */
export function scale(v: Point, s: number): Point {
  return [v[0] * s, v[1] * s];
}

/**
 * Calculate the Euclidean distance between two points
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Calculate the midpoint between two points
 */
export function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Project a point onto a line segment defined by points a and b
 * @returns An object containing the projected point and the parameter t (0 to 1)
 */
export function projectPointOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const ab = sub(b, a);
  const ap = sub(p, a);

  const abLenSq = dot(ab, ab);

  // degenerate segment
  if (abLenSq === 0) {
    return { point: a, t: 0 };
  }

  let t = dot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t)); // clamp to segment

  const projection = add(a, scale(ab, t));

  return { point: projection, t };
}

/**
 * Calculate circular distance between two indices in a circular array
 */
export function circularDistance(a: number, b: number, n: number): number {
  return (b - a + n) % n;
}
