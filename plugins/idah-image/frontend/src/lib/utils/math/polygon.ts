// ---------------------------------------------------------------------------
// Polygon interpolation using flubber
// ---------------------------------------------------------------------------

import * as flubber from 'flubber';

import type { Point } from "$lib/utils/math/point";

// The `@types/flubber` package types `interpolate()` as always returning an
// SVG path string interpolator. When `{ string: false }` is passed, flubber
// instead returns an interpolator that yields `number[][]` (arrays of points).
// We override the return type here to reflect that.

type FlubberPointInterpolator = (t: number) => Point[];

function flubberInterpolate(fromShape: Point[], toShape: Point[], options?: { string?: false; maxSegmentLength?: number }): FlubberPointInterpolator {
  return flubber.interpolate(fromShape as any, toShape as any, { ...options, string: false }) as unknown as FlubberPointInterpolator;
}

/**
 * Interpolate between two polygons using flubber's vertex-morphing algorithm.
 *
 * Flubber intelligently adds/removes vertices to smoothly morph between
 * polygons with different vertex counts. The result is an array of points
 * with the same length at every `t` value.
 *
 * @param polyFrom - Source polygon vertices.
 * @param polyTo   - Target polygon vertices.
 * @param t        - Interpolation parameter (0 = polyFrom, 1 = polyTo).
 * @returns The interpolated polygon vertices at time `t`.
 */
export function interpolatePolygon(polyFrom: Point[], polyTo: Point[], t: number): Point[] {
  const fn = flubberInterpolate(polyFrom, polyTo, {
    maxSegmentLength: Infinity,
  });
  return fn(t);
}
