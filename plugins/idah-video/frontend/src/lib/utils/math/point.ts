// ---------------------------------------------------------------------------
// math/point.ts — 2D point type and vector operations
// ---------------------------------------------------------------------------

/** 2D point represented as [x, y]. */
export type Point = [number, number];

/** Dot product of two vectors. */
export function dot(a: Point, b: Point): number {
  return a[0] * b[0] + a[1] * b[1];
}

/** Subtract b from a (a - b). */
export function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}

/** Add a and b. */
export function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

/** Scale a vector by scalar s. */
export function scale(v: Point, s: number): Point {
  return [v[0] * s, v[1] * s];
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Midpoint between two points. */
export function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Project point p onto segment [a, b]. Returns the projected point and parameter t. */
export function projectPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
): { point: Point; t: number } {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return { point: a, t: 0 };
  let t = dot(ap, ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { point: add(a, scale(ab, t)), t };
}

/** Circular distance between two indices in an n-element array. */
export function circularDistance(a: number, b: number, n: number): number {
  return (b - a + n) % n;
}

/** Rotate a point around a center by an angle (radians). */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

/** Compute the centroid (average) of a set of points. */
export function centroid(pts: Point[]): Point {
  if (pts.length === 0) return [0, 0];
  const sum = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}
