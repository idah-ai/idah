import { describe, expect, it } from "vitest";

import {
  centroid,
  distance,
  dot,
  midpoint,
  projectPointOnSegment,
  rotatePoint,
  scale,
  sub,
  add,
  circularDistance,
  type Point,
} from "$lib/utils/math/point";

describe("point", () => {
  describe("dot", () => {
    it("returns 0 for perpendicular vectors", () => {
      expect(dot([1, 0], [0, 1])).toBe(0);
    });
    it("returns product for parallel vectors", () => {
      expect(dot([2, 3], [4, 5])).toBe(2 * 4 + 3 * 5);
    });
  });

  describe("sub", () => {
    it("subtracts two points", () => {
      expect(sub([5, 7], [2, 3])).toEqual([3, 4]);
    });
  });

  describe("add", () => {
    it("adds two points", () => {
      expect(add([1, 2], [3, 4])).toEqual([4, 6]);
    });
  });

  describe("scale", () => {
    it("scales a vector", () => {
      expect(scale([2, 3], 4)).toEqual([8, 12]);
    });
  });

  describe("distance", () => {
    it("returns 0 for identical points", () => {
      expect(distance([1, 2], [1, 2])).toBe(0);
    });
    it("computes euclidean distance", () => {
      expect(distance([0, 0], [3, 4])).toBe(5);
    });
  });

  describe("midpoint", () => {
    it("returns the midpoint", () => {
      expect(midpoint([1, 2], [5, 8])).toEqual([3, 5]);
    });
  });

  describe("projectPointOnSegment", () => {
    it("returns the same point when on the segment", () => {
      const result = projectPointOnSegment([2, 2], [0, 0], [4, 4]);
      expect(result.point[0]).toBeCloseTo(2);
      expect(result.point[1]).toBeCloseTo(2);
    });
    it("clamps to start when before segment", () => {
      const result = projectPointOnSegment([-1, -1], [0, 0], [4, 4]);
      expect(result.point).toEqual([0, 0]);
      expect(result.t).toBe(0);
    });
    it("clamps to end when after segment", () => {
      const result = projectPointOnSegment([10, 10], [0, 0], [4, 4]);
      expect(result.point).toEqual([4, 4]);
      expect(result.t).toBe(1);
    });
    it("handles degenerate segment", () => {
      const result = projectPointOnSegment([5, 5], [2, 2], [2, 2]);
      expect(result.point).toEqual([2, 2]);
    });
  });

  describe("circularDistance", () => {
    it("computes forward distance", () => {
      expect(circularDistance(1, 3, 5)).toBe(2);
    });
    it("wraps around", () => {
      expect(circularDistance(3, 1, 5)).toBe(3);
    });
  });

  describe("rotatePoint", () => {
    it("returns same point when angle is 0", () => {
      expect(rotatePoint([3, 4], [0, 0], 0)).toEqual([3, 4]);
    });
    it("rotates 90 degrees around origin", () => {
      const r = rotatePoint([1, 0], [0, 0], Math.PI / 2);
      expect(r[0]).toBeCloseTo(0);
      expect(r[1]).toBeCloseTo(1);
    });
    it("rotates 180 degrees around center", () => {
      const r = rotatePoint([3, 1], [1, 1], Math.PI);
      expect(r[0]).toBeCloseTo(-1);
      expect(r[1]).toBeCloseTo(1);
    });
  });

  describe("centroid", () => {
    it("returns [0,0] for empty array", () => {
      expect(centroid([])).toEqual([0, 0]);
    });
    it("computes centroid of 3 points", () => {
      expect(centroid([[0, 0], [4, 0], [0, 4]])).toEqual([4 / 3, 4 / 3]);
    });
  });
});
