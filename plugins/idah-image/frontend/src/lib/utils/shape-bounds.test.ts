// ---------------------------------------------------------------------------
// shape-bounds.test.ts — framing points for viewport centering per shape type.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { shapeBoundsPoints } from "./shape-bounds";
import { IMAGE_BOUNDING_BOX, IMAGE_POLYGON, IMAGE_LINE, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_MASK } from "$lib/types";

const MW = 1000;
const MH = 500;

describe("shapeBoundsPoints", () => {
  it("bounding box: the bounds of its points", () => {
    const pts = shapeBoundsPoints(
      {
        points: [
          [0.1, 0.2],
          [0.3, 0.4],
          [0.5, 0.6],
          [0.2, 0.1],
        ],
      },
      IMAGE_BOUNDING_BOX,
      MW,
      MH,
    );
    expect(pts).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
      [0.2, 0.1],
    ]);
  });

  it("polygon: the bounds of its points", () => {
    const pts = shapeBoundsPoints(
      {
        points: [
          [0.1, 0.2],
          [0.4, 0.5],
        ],
      },
      IMAGE_POLYGON,
      MW,
      MH,
    );
    expect(pts).toEqual([
      [0.1, 0.2],
      [0.4, 0.5],
    ]);
  });

  it("line: the bounds of its 2 points", () => {
    const pts = shapeBoundsPoints(
      {
        points: [
          [0.1, 0.2],
          [0.4, 0.5],
        ],
      },
      IMAGE_LINE,
      MW,
      MH,
    );
    expect(pts).toEqual([
      [0.1, 0.2],
      [0.4, 0.5],
    ]);
  });

  it("ellipse: points[0] ± points[1]", () => {
    const pts = shapeBoundsPoints(
      {
        points: [
          [0.5, 0.5],
          [0.2, 0.1],
        ],
      },
      IMAGE_ELLIPSE,
      MW,
      MH,
    );
    expect(pts).toEqual([
      [0.3, 0.4],
      [0.7, 0.4],
      [0.7, 0.6],
      [0.3, 0.6],
    ]);
  });

  it("circle: points[0] ± radius × min(width, height), converted per axis", () => {
    // radius 0.2 × min(1000, 500) = 100px → rx = 100/1000 = 0.1, ry = 100/500 = 0.2.
    const pts = shapeBoundsPoints({ points: [[0.5, 0.5]], radius: 0.2 }, IMAGE_CIRCLE, MW, MH);
    expect(pts).toEqual([
      [0.4, 0.3],
      [0.6, 0.3],
      [0.6, 0.7],
      [0.4, 0.7],
    ]);
  });

  it("rotated shape: AABB corners rotated around their centroid", () => {
    const pts = shapeBoundsPoints(
      {
        points: [
          [0.1, 0.1],
          [0.3, 0.1],
          [0.3, 0.3],
          [0.1, 0.3],
        ],
        angle: Math.PI,
      },
      IMAGE_POLYGON,
      MW,
      MH,
    );
    // Rotating 180° about the centroid (0.2, 0.2) maps each point to 2c - p.
    expect(pts![0][0]).toBeCloseTo(0.3, 10);
    expect(pts![0][1]).toBeCloseTo(0.3, 10);
    expect(pts![1][0]).toBeCloseTo(0.1, 10);
    expect(pts![1][1]).toBeCloseTo(0.3, 10);
    expect(pts![2][0]).toBeCloseTo(0.1, 10);
    expect(pts![2][1]).toBeCloseTo(0.1, 10);
    expect(pts![3][0]).toBeCloseTo(0.3, 10);
    expect(pts![3][1]).toBeCloseTo(0.1, 10);
  });

  it("mask with no points: null (no viewport change)", () => {
    expect(shapeBoundsPoints({ points: [] }, IMAGE_MASK, MW, MH)).toBeNull();
    expect(shapeBoundsPoints(undefined, IMAGE_MASK, MW, MH)).toBeNull();
  });
});
