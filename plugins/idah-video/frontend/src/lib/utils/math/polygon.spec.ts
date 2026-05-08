import { describe, expect, it } from "vitest";
import { interpolatePolygon } from "$lib/utils/math/polygon";
import { centroid } from "$lib/utils/math/point";
import type { Point } from "$lib/utils/math/point";

const FRAME_30: Point[] = [
  [0.1, 0.1], [0.3, 0.05], [0.35, 0.2], [0.15, 0.25],
];
const FRAME_55: Point[] = [
  [0.12, 0.08], [0.32, 0.04], [0.37, 0.18], [0.17, 0.23],
];
const FRAME_80: Point[] = [
  [0.15, 0.05], [0.35, 0.02], [0.40, 0.15], [0.30, 0.25], [0.20, 0.20],
];

describe("interpolatePolygon", () => {
  it("30→55 both 4 vertices, t=0 returns frame_30 vertices", () => {
    const r = interpolatePolygon(FRAME_30, FRAME_55, 0).map((v) => v.point);
    expect(r).toHaveLength(4);
    const c = centroid(r);
    expect(c[0]).toBeCloseTo(centroid(FRAME_30)[0], 5);
    expect(c[1]).toBeCloseTo(centroid(FRAME_30)[1], 5);
  });

  it("30→55 both 4 vertices, t=1 returns frame_55 vertices", () => {
    const r = interpolatePolygon(FRAME_30, FRAME_55, 1).map((v) => v.point);
    expect(r).toHaveLength(4);
    const c = centroid(r);
    expect(c[0]).toBeCloseTo(centroid(FRAME_55)[0], 5);
    expect(c[1]).toBeCloseTo(centroid(FRAME_55)[1], 5);
  });

  it("30→80 different vertex counts, t=0 returns 5 vertices with frame_30 centroid", () => {
    const r = interpolatePolygon(FRAME_30, FRAME_80, 0).map((v) => v.point);
    expect(r).toHaveLength(5);
    const c = centroid(r);
    expect(c[0]).toBeCloseTo(centroid(FRAME_30)[0], 1);
    expect(c[1]).toBeCloseTo(centroid(FRAME_30)[1], 1);
  });

  it("30→80 at t=1 returns 5 vertices matching frame_80 centroid", () => {
    const r = interpolatePolygon(FRAME_30, FRAME_80, 1).map((v) => v.point);
    expect(r).toHaveLength(5);
    const c = centroid(r);
    expect(c[0]).toBeCloseTo(centroid(FRAME_80)[0], 1);
    expect(c[1]).toBeCloseTo(centroid(FRAME_80)[1], 1);
  });

  it("30→80 at t=0.5 centroid is midpoint", () => {
    const c30 = centroid(FRAME_30);
    const c80 = centroid(FRAME_80);
    const r = interpolatePolygon(FRAME_30, FRAME_80, 0.5).map((v) => v.point);
    const cr = centroid(r);
    expect(cr[0]).toBeCloseTo((c30[0] + c80[0]) / 2, 0);
    expect(cr[1]).toBeCloseTo((c30[1] + c80[1]) / 2, 0);
  });

  it("80→30 reversed, t=1 returns frame_30 centroid", () => {
    const r = interpolatePolygon(FRAME_80, FRAME_30, 1).map((v) => v.point);
    expect(r).toHaveLength(5);
    const c = centroid(r);
    expect(c[0]).toBeCloseTo(centroid(FRAME_30)[0], 1);
    expect(c[1]).toBeCloseTo(centroid(FRAME_30)[1], 1);
  });

  it("correct vertex counts for all combos", () => {
    expect(interpolatePolygon(FRAME_30, FRAME_55, 0)).toHaveLength(4);
    expect(interpolatePolygon(FRAME_30, FRAME_55, 0.5)).toHaveLength(4);
    expect(interpolatePolygon(FRAME_30, FRAME_55, 1)).toHaveLength(4);
    expect(interpolatePolygon(FRAME_30, FRAME_80, 0)).toHaveLength(5);
    expect(interpolatePolygon(FRAME_30, FRAME_80, 0.5)).toHaveLength(5);
    expect(interpolatePolygon(FRAME_30, FRAME_80, 1)).toHaveLength(5);
    expect(interpolatePolygon(FRAME_80, FRAME_30, 0)).toHaveLength(5);
    expect(interpolatePolygon(FRAME_80, FRAME_30, 0.5)).toHaveLength(5);
    expect(interpolatePolygon(FRAME_80, FRAME_30, 1)).toHaveLength(5);
  });
});
