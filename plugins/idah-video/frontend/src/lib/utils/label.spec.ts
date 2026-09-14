// ---------------------------------------------------------------------------
// label.spec.ts — Unit tests for category label text and centre geometry
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { annotationLabel, labelCenterPx } from "./label";
import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";

const W = 1000;
const H = 500;

/** Unrotated AABB corners in [tl, tr, br, bl] order. */
const box = (x1: number, y1: number, x2: number, y2: number) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

/** A video shape with explicit keyframes. */
const shape = (type: string, frames: { frame: number; points: number[][]; angle?: number }[]) => ({
  type,
  start: frames[0].frame,
  end: frames[frames.length - 1].frame,
  frames,
});

describe("labelCenterPx", () => {
  describe("bounding box", () => {
    it("returns the box centre at an exact keyframe", () => {
      const ann = { shape: shape(VIDEO_BOUNDING_BOX, [{ frame: 0, points: box(0.2, 0.4, 0.6, 0.8) }]) };
      expect(labelCenterPx(ann, W, H, 0)).toEqual([400, 300]);
    });

    it("is unaffected by corner ordering", () => {
      const pts = [[0.6, 0.8], [0.2, 0.8], [0.2, 0.4], [0.6, 0.4]];
      const ann = { shape: shape(VIDEO_BOUNDING_BOX, [{ frame: 0, points: pts }]) };
      expect(labelCenterPx(ann, W, H, 0)).toEqual([400, 300]);
    });

    // The whole reason video needs its own variant: the centre must track the
    // interpolated position while scrubbing, not sit at a stored keyframe.
    it("follows the interpolated position between keyframes", () => {
      const ann = {
        shape: shape(VIDEO_BOUNDING_BOX, [
          { frame: 0, points: box(0.0, 0.0, 0.2, 0.2) },
          { frame: 10, points: box(0.4, 0.4, 0.6, 0.6) },
        ]),
      };
      const start = labelCenterPx(ann, W, H, 0)!;
      const mid = labelCenterPx(ann, W, H, 5)!;
      const end = labelCenterPx(ann, W, H, 10)!;

      // Centres of the two keyframe boxes: (100, 50) and (500, 250).
      expect(start).toEqual([100, 50]);
      expect(end).toEqual([500, 250]);
      // Halfway between the two keyframes.
      expect(mid[0]).toBeCloseTo(300, 6);
      expect(mid[1]).toBeCloseTo(150, 6);
      expect(mid[0]).toBeGreaterThan(start[0]);
      expect(mid[0]).toBeLessThan(end[0]);
    });

    it("returns null outside the annotation's frame range", () => {
      const ann = {
        shape: shape(VIDEO_BOUNDING_BOX, [
          { frame: 10, points: box(0.2, 0.2, 0.4, 0.4) },
          { frame: 20, points: box(0.2, 0.2, 0.4, 0.4) },
        ]),
      };
      expect(labelCenterPx(ann, W, H, 5)).toBeNull();
      expect(labelCenterPx(ann, W, H, 25)).toBeNull();
      expect(labelCenterPx(ann, W, H, 15)).not.toBeNull();
    });

    // A 200px x 200px square in pixel space, centred at (400px, 250px). The
    // centre is the rotation pivot, so it stays put at any angle.
    const squareFrame = { frame: 0, points: box(0.3, 0.3, 0.5, 0.7) };

    it("keeps the same centre at any angle", () => {
      const without = { shape: shape(VIDEO_BOUNDING_BOX, [squareFrame]) };
      expect(labelCenterPx(without, W, H, 0)!).toEqual([400, 250]);
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        const ann = { shape: shape(VIDEO_BOUNDING_BOX, [{ ...squareFrame, angle }]) };
        const rotated = labelCenterPx(ann, W, H, 0)!;
        expect(rotated[0]).toBeCloseTo(400, 6);
        expect(rotated[1]).toBeCloseTo(250, 6);
      }
    });

    it("returns null for an incomplete corner set", () => {
      const ann = { shape: shape(VIDEO_BOUNDING_BOX, [{ frame: 0, points: [[0.1, 0.1]] }]) };
      expect(labelCenterPx(ann, W, H, 0)).toBeNull();
    });
  });

  describe("polygon", () => {
    it("returns the polygon's visual centre", () => {
      // A square polygon — its visual centre is its geometric centre (400, 250).
      const ann = {
        shape: shape(VIDEO_POLYGON, [{ frame: 0, points: [[0.3, 0.3], [0.5, 0.3], [0.5, 0.7], [0.3, 0.7]] }]),
      };
      const center = labelCenterPx(ann, W, H, 0)!;
      expect(Math.hypot(center[0] - 400, center[1] - 250)).toBeLessThan(2);
    });

    it("returns null for a degenerate polygon", () => {
      const ann = { shape: shape(VIDEO_POLYGON, [{ frame: 0, points: [[0.1, 0.1]] }]) };
      expect(labelCenterPx(ann, W, H, 0)).toBeNull();
    });
  });

  describe("missing geometry and unknown shapes", () => {
    it("returns null when there are no keyframes", () => {
      expect(labelCenterPx({ shape: { type: VIDEO_BOUNDING_BOX, start: 0, end: 10, frames: [] } }, W, H, 0)).toBeNull();
    });

    it("returns null when there is no shape at all", () => {
      expect(labelCenterPx({}, W, H, 0)).toBeNull();
    });

    it("returns null for an unrecognised shape type", () => {
      const ann = { shape: shape("idah-video:something-new", [{ frame: 0, points: box(0.1, 0.1, 0.2, 0.2) }]) };
      expect(labelCenterPx(ann, W, H, 0)).toBeNull();
    });
  });
});

describe("annotationLabel", () => {
  const config = [
    { id: "vehicle/commercial/truck", label: "Truck" },
    { id: "car", label: "Car" },
    { id: "vehicle/van", label: "" },
  ];
  const lookup = (id: string) => config.find((c) => c.id === id) ?? null;

  it("returns null when the annotation has no category", () => {
    expect(annotationLabel({ value: {} }, lookup)).toBeNull();
    expect(annotationLabel({}, lookup)).toBeNull();
  });

  // REGRESSION: categoryValueToLabel(value) with one argument POPS the leaf
  // segment. Calling it without the replacement label silently truncates every
  // label to its parent path — "Vehicle / Commercial" instead of the full path.
  it("keeps the full path including the leaf segment", () => {
    const result = annotationLabel({ value: { category: "vehicle/commercial/truck" } }, lookup);
    expect(result).toEqual({ text: "Vehicle / Commercial / Truck", unresolved: false });
    expect(result!.text).not.toBe("Vehicle / Commercial");
  });

  it("uses the config label for the leaf, not the raw id segment", () => {
    const withRename = [{ id: "vehicle/commercial/truck", label: "Heavy Goods Vehicle" }];
    const result = annotationLabel(
      { value: { category: "vehicle/commercial/truck" } },
      (id) => withRename.find((c) => c.id === id) ?? null,
    );
    expect(result!.text).toBe("Vehicle / Commercial / Heavy Goods Vehicle");
  });

  it("handles a single-segment category", () => {
    expect(annotationLabel({ value: { category: "car" } }, lookup)).toEqual({ text: "Car", unresolved: false });
  });

  it("falls back to the capitalized leaf when the config label is empty", () => {
    expect(annotationLabel({ value: { category: "vehicle/van" } }, lookup)).toEqual({
      text: "Vehicle / Van",
      unresolved: false,
    });
  });

  it("flags a category that is set but missing from the config", () => {
    expect(annotationLabel({ value: { category: "vehicle/commercial/bus" } }, lookup)).toEqual({
      text: "Vehicle / Commercial / Bus",
      unresolved: true,
    });
  });

  it("flags an unknown single-segment category", () => {
    expect(annotationLabel({ value: { category: "boat" } }, lookup)).toEqual({ text: "Boat", unresolved: true });
  });
});
