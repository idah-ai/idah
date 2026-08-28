// ---------------------------------------------------------------------------
// label.spec.ts — Unit tests for category label text and centre geometry
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { annotationLabel, labelCenterPx } from "./label";
import {
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_MASK,
  IMAGE_POLYGON,
} from "$lib/types";

const W = 1000;
const H = 500;

/** Unrotated AABB corners in [tl, tr, br, bl] order. */
const box = (x1: number, y1: number, x2: number, y2: number) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

describe("labelCenterPx", () => {
  describe("bounding box", () => {
    it("returns the centre of the box in media pixels", () => {
      const ann = { shape: { type: IMAGE_BOUNDING_BOX, points: box(0.2, 0.4, 0.6, 0.8) } };
      expect(labelCenterPx(ann, W, H)).toEqual([400, 300]);
    });

    it("is unaffected by corner ordering", () => {
      const ann = { shape: { type: IMAGE_BOUNDING_BOX, points: [[0.6, 0.8], [0.2, 0.8], [0.2, 0.4], [0.6, 0.4]] } };
      expect(labelCenterPx(ann, W, H)).toEqual([400, 300]);
    });

    // The centre is the rotation pivot, so a rotated box keeps the same centre —
    // unlike the old corner anchor, which swept outward with the rotation.
    const squarePts = box(0.3, 0.3, 0.5, 0.7); // 200px x 200px, centre (400px, 250px)

    it("keeps the same centre at any angle", () => {
      const unrotated = labelCenterPx({ shape: { type: IMAGE_BOUNDING_BOX, points: squarePts } }, W, H)!;
      expect(unrotated[0]).toBeCloseTo(400, 6);
      expect(unrotated[1]).toBeCloseTo(250, 6);
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        const rotated = labelCenterPx({ shape: { type: IMAGE_BOUNDING_BOX, points: squarePts, angle } }, W, H)!;
        expect(rotated[0]).toBeCloseTo(400, 6);
        expect(rotated[1]).toBeCloseTo(250, 6);
      }
    });

    it("returns null when points are missing or incomplete", () => {
      expect(labelCenterPx({ shape: { type: IMAGE_BOUNDING_BOX } }, W, H)).toBeNull();
      expect(labelCenterPx({ shape: { type: IMAGE_BOUNDING_BOX, points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });
  });

  // An ellipse is stored as [[cx, cy], [rx, ry]] + angle — centroid and radii,
  // NOT 4 AABB corners. The label centre is simply (cx, cy).
  describe("ellipse", () => {
    it("returns the centroid (cx, cy) in media pixels", () => {
      const ann = { shape: { type: IMAGE_ELLIPSE, points: [[0.3, 0.4], [0.2, 0.1]] } };
      const center = labelCenterPx(ann, W, H)!;
      expect(center[0]).toBeCloseTo(300, 6);
      expect(center[1]).toBeCloseTo(200, 6);
    });

    it("ignores the radii — the centre is the first point", () => {
      const ann = { shape: { type: IMAGE_ELLIPSE, points: [[0.5, 0.5], [0.1, 0.1]] } };
      const center = labelCenterPx(ann, W, H)!;
      expect(center[0]).toBeCloseTo(500, 6);
      expect(center[1]).toBeCloseTo(250, 6);
    });

    it("is unchanged by rotation", () => {
      const pts = [[0.4, 0.5], [0.1, 0.2]];
      const unrotated = labelCenterPx({ shape: { type: IMAGE_ELLIPSE, points: pts } }, W, H)!;
      const rotated = labelCenterPx({ shape: { type: IMAGE_ELLIPSE, points: pts, angle: Math.PI / 4 } }, W, H)!;
      expect(rotated).toEqual(unrotated);
      expect(unrotated[0]).toBeCloseTo(400, 6);
      expect(unrotated[1]).toBeCloseTo(250, 6);
    });

    it("returns null when the radii point is missing", () => {
      expect(labelCenterPx({ shape: { type: IMAGE_ELLIPSE, points: [[0.5, 0.5]] } }, W, H)).toBeNull();
      expect(labelCenterPx({ shape: { type: IMAGE_ELLIPSE } }, W, H)).toBeNull();
    });
  });

  describe("circle", () => {
    it("returns the centre point, ignoring the radius", () => {
      const ann = { shape: { type: IMAGE_CIRCLE, points: [[0.5, 0.5]], radius: 0.1 } };
      expect(labelCenterPx(ann, W, H)).toEqual([500, 250]);
    });

    it("returns null with no centre point", () => {
      expect(labelCenterPx({ shape: { type: IMAGE_CIRCLE, points: [] } }, W, H)).toBeNull();
    });
  });

  describe("polygon and line", () => {
    it("returns the polygon's visual centre", () => {
      // A square polygon — its visual centre is its geometric centre (400, 250).
      const ann = { shape: { type: IMAGE_POLYGON, points: [[0.3, 0.3], [0.5, 0.3], [0.5, 0.7], [0.3, 0.7]] } };
      const center = labelCenterPx(ann, W, H)!;
      expect(Math.hypot(center[0] - 400, center[1] - 250)).toBeLessThan(2);
    });

    it("returns the midpoint of the two line endpoints", () => {
      const ann = { shape: { type: IMAGE_LINE, points: [[0.8, 0.2], [0.3, 0.9]] } };
      const center = labelCenterPx(ann, W, H)!;
      expect(center[0]).toBeCloseTo(550, 6);
      expect(center[1]).toBeCloseTo(275, 6);
    });

    it("returns null for a degenerate line", () => {
      expect(labelCenterPx({ shape: { type: IMAGE_LINE, points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });
  });

  describe("excluded and unknown shapes", () => {
    it("returns null for masks", () => {
      expect(labelCenterPx({ shape: { type: IMAGE_MASK, points: [[0.1, 0.1], [0.5, 0.5]] } }, W, H)).toBeNull();
    });

    it("returns null for an unrecognised shape type", () => {
      expect(labelCenterPx({ shape: { type: "idah-image:something-new", points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });

    it("returns null when there is no shape at all", () => {
      expect(labelCenterPx({}, W, H)).toBeNull();
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
    const result = annotationLabel({ value: { category: "vehicle/commercial/bus" } }, lookup);
    expect(result).toEqual({ text: "Vehicle / Commercial / Bus", unresolved: true });
  });

  it("flags an unknown single-segment category", () => {
    expect(annotationLabel({ value: { category: "boat" } }, lookup)).toEqual({ text: "Boat", unresolved: true });
  });
});
