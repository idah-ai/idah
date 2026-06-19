import { describe, expect, it } from "vitest";

import { bboxToPoints, interpolateBBox, normalizeRect, type BBox } from "$lib/utils/math/bbox";

describe("bbox", () => {
  describe("bboxToPoints", () => {
    it("converts AABB to 4 corners in tl/tr/br/bl order", () => {
      const bbox: BBox = [0.1, 0.2, 0.5, 0.8];
      expect(bboxToPoints(bbox)).toEqual([
        [0.1, 0.2], // tl
        [0.5, 0.2], // tr
        [0.5, 0.8], // br
        [0.1, 0.8], // bl
      ]);
    });
  });

  describe("normalizeRect", () => {
    it("orders 4 points in canonical form", () => {
      // Input in random order
      const pts = [
        [10, 30], // br
        [10, 10], // tl
        [30, 30], // br? no, br
        [30, 10], // tr
      ];
      expect(normalizeRect(pts as any)).toEqual([
        [10, 10], // tl
        [30, 10], // tr
        [30, 30], // br
        [10, 30], // bl
      ]);
    });
    it("returns input unchanged if not 4 points", () => {
      const pts = [[1, 2]];
      expect(normalizeRect(pts as any)).toBe(pts);
    });
  });

  describe("interpolateBBox", () => {
    it("returns first bbox at t=0", () => {
      const a: BBox = [0, 0, 10, 10];
      const b: BBox = [5, 5, 15, 15];
      expect(interpolateBBox(a, b, 0)).toEqual(a);
    });
    it("returns second bbox at t=1", () => {
      const a: BBox = [0, 0, 10, 10];
      const b: BBox = [5, 5, 15, 15];
      expect(interpolateBBox(a, b, 1)).toEqual(b);
    });
    it("interpolates at t=0.5", () => {
      const a: BBox = [0, 0, 10, 10];
      const b: BBox = [10, 10, 20, 20];
      expect(interpolateBBox(a, b, 0.5)).toEqual([5, 5, 15, 15]);
    });
  });
});
