import { describe, expect, it } from "vitest";

import { polygonVisualCenter } from "$lib/utils/math/polylabel";
import { centroid, type Point } from "$lib/utils/math/point";

/** Ray-casting point-in-polygon, mirrored from Shapes/Polygon/utils.ts. */
function pointInPolygon([px, py]: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe("polygonVisualCenter", () => {
  it("returns the geometric centre of a square", () => {
    const square: Point[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const c = polygonVisualCenter(square);
    expect(c[0]).toBeCloseTo(50, 1);
    expect(c[1]).toBeCloseTo(50, 1);
  });

  it("stays inside a triangle and near its centre", () => {
    const triangle: Point[] = [
      [0, 0],
      [120, 0],
      [0, 90],
    ];
    const c = polygonVisualCenter(triangle);
    expect(pointInPolygon(c, triangle)).toBe(true);
  });

  it("lands inside a concave L-shape where the vertex average falls outside", () => {
    // An L: the notch pulls the vertex-average centroid into the empty corner.
    const l: Point[] = [
      [0, 0],
      [100, 0],
      [100, 40],
      [40, 40],
      [40, 100],
      [0, 100],
    ];
    const avg = centroid(l);
    const c = polygonVisualCenter(l);

    // The naive centroid sits in the missing quadrant; the visual centre does not.
    expect(pointInPolygon(avg, l)).toBe(false);
    expect(pointInPolygon(c, l)).toBe(true);
  });

  it("falls back to the average for a degenerate ring (< 3 points)", () => {
    const line: Point[] = [
      [10, 20],
      [30, 60],
    ];
    expect(polygonVisualCenter(line)).toEqual(centroid(line));
  });
});
