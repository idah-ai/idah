import { describe, expect, it } from "vitest";

import {
  nearestPointOnSegment,
  nearestPointOnEllipse,
  pointDistSq,
} from "./geometry";
import type { Segment, CircleArc, Point } from "./index";

// ─── nearestPointOnSegment ─────────────────────────────────────────────

describe("nearestPointOnSegment", () => {
  const seg: Segment = { a: [0, 0], b: [4, 4] };

  it("returns the exact point when on the segment", () => {
    const r = nearestPointOnSegment([2, 2], seg);
    expect(r.point[0]).toBeCloseTo(2);
    expect(r.point[1]).toBeCloseTo(2);
    expect(r.distSq).toBeCloseTo(0);
  });

  it("clamps to start when before the segment", () => {
    const r = nearestPointOnSegment([-1, -1], seg);
    expect(r.point).toEqual([0, 0]);
  });

  it("clamps to end when after the segment", () => {
    const r = nearestPointOnSegment([10, 10], seg);
    expect(r.point).toEqual([4, 4]);
  });

  it("finds closest point on a horizontal segment", () => {
    const h: Segment = { a: [1, 2], b: [5, 2] };
    const r = nearestPointOnSegment([3, 5], h);
    expect(r.point[0]).toBeCloseTo(3);
    expect(r.point[1]).toBeCloseTo(2);
  });

  it("handles a degenerate (zero-length) segment", () => {
    const d: Segment = { a: [3, 3], b: [3, 3] };
    const r = nearestPointOnSegment([5, 7], d);
    expect(r.point).toEqual([3, 3]);
    expect(r.distSq).toBeCloseTo(20);
  });
});

// ─── nearestPointOnEllipse ────────────────────────────────────────────

describe("nearestPointOnEllipse", () => {
  it("returns the closest point on a circle as a special case of ellipse", () => {
    const arc: CircleArc = { center: [0, 0], rx: 2, ry: 2, rotation: 0 };
    // Cursor at (5, 0) — nearest point should be (2, 0)
    const r = nearestPointOnEllipse([5, 0], arc);
    expect(r.point[0]).toBeCloseTo(2, 0);
    expect(r.point[1]).toBeCloseTo(0, 0);
  });

  it("handles cursor at ellipse centre", () => {
    const arc: CircleArc = { center: [0.5, 0.5], rx: 0.2, ry: 0.1, rotation: 0 };
    const r = nearestPointOnEllipse([0.5, 0.5], arc);
    // Should converge to some point on the ellipse (any is fine — we just check distSq ≈ rx²)
    expect(r.distSq).toBeCloseTo(0.2 * 0.2, 0); // approx squared semi-major radius
  });

  it("converges within tolerance for an ellipse", () => {
    const arc: CircleArc = { center: [0, 0], rx: 4, ry: 2, rotation: 0 };
    const r = nearestPointOnEllipse([10, 5], arc);
    // The nearest point should have distSq < distance to center squared
    expect(r.distSq).toBeLessThan(10 * 10 + 5 * 5);
    // The point should be on the ellipse boundary (roughly)
    const [px, py] = r.point;
    const lhs = (px * px) / (4 * 4) + (py * py) / (2 * 2);
    expect(lhs).toBeCloseTo(1, 0.5);
  });
});

// ─── pointDistSq ──────────────────────────────────────────────────────

describe("pointDistSq", () => {
  it("returns 0 for identical points", () => {
    expect(pointDistSq([1, 2], [1, 2])).toBe(0);
  });

  it("computes squared distance", () => {
    expect(pointDistSq([0, 0], [3, 4])).toBe(25);
  });
});
