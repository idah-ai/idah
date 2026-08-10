// ---------------------------------------------------------------------------
// label.spec.ts — Unit tests for category label text and anchor geometry
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { annotationLabel, labelAnchorPx } from "./label";
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

describe("labelAnchorPx", () => {
  describe("bounding box", () => {
    it("returns the top-left corner in media pixels", () => {
      const ann = { shape: { type: IMAGE_BOUNDING_BOX, points: box(0.2, 0.4, 0.6, 0.8) } };
      expect(labelAnchorPx(ann, W, H)).toEqual([200, 200]);
    });

    it("is unaffected by corner ordering", () => {
      const ann = { shape: { type: IMAGE_BOUNDING_BOX, points: [[0.6, 0.8], [0.2, 0.8], [0.2, 0.4], [0.6, 0.4]] } };
      expect(labelAnchorPx(ann, W, H)).toEqual([200, 200]);
    });

    it("treats angle 0 the same as no angle", () => {
      const pts = box(0.2, 0.4, 0.6, 0.8);
      expect(labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX, points: pts, angle: 0 } }, W, H)).toEqual(
        labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX, points: pts } }, W, H),
      );
    });

    // A square in PIXEL space, so rotation is easy to reason about: 0.2 of the
    // 1000px width and 0.4 of the 500px height are both 200px.
    const squarePts = box(0.3, 0.3, 0.5, 0.7); // 200px x 200px, centre (400px, 250px)

    it("rotating 90° gives the same AABB for a square", () => {
      const rotated = labelAnchorPx(
        { shape: { type: IMAGE_BOUNDING_BOX, points: squarePts, angle: Math.PI / 2 } },
        W,
        H,
      )!;
      expect(rotated[0]).toBeCloseTo(300, 6);
      expect(rotated[1]).toBeCloseTo(150, 6);
    });

    it("rotating 180° gives the same AABB for a square", () => {
      const rotated = labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX, points: squarePts, angle: Math.PI } }, W, H)!;
      expect(rotated[0]).toBeCloseTo(300, 6);
      expect(rotated[1]).toBeCloseTo(150, 6);
    });

    it("rotating 45° expands the AABB by a factor of sqrt(2)", () => {
      const rotated = labelAnchorPx(
        { shape: { type: IMAGE_BOUNDING_BOX, points: squarePts, angle: Math.PI / 4 } },
        W,
        H,
      )!;
      // Half-diagonal of a 200px square is 100*sqrt(2) ≈ 141.42 from the centre.
      const half = 100 * Math.SQRT2;
      expect(rotated[0]).toBeCloseTo(400 - half, 6);
      expect(rotated[1]).toBeCloseTo(250 - half, 6);
    });

    it("moves the anchor away from the stored top-left when rotated", () => {
      const unrotated = labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX, points: squarePts } }, W, H)!;
      const rotated = labelAnchorPx(
        { shape: { type: IMAGE_BOUNDING_BOX, points: squarePts, angle: Math.PI / 4 } },
        W,
        H,
      )!;
      expect(rotated).not.toEqual(unrotated);
    });

    it("returns null when points are missing or incomplete", () => {
      expect(labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX } }, W, H)).toBeNull();
      expect(labelAnchorPx({ shape: { type: IMAGE_BOUNDING_BOX, points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });
  });

  // REGRESSION: an ellipse is stored as [[cx, cy], [rx, ry]] + angle — centroid
  // and radii, NOT the 4 AABB corners that BBox uses. Requiring 4 points here
  // silently returned null for every ellipse, so no ellipse ever got a label.
  describe("ellipse", () => {
    it("derives the top-left from centroid and radii", () => {
      const ann = { shape: { type: IMAGE_ELLIPSE, points: [[0.3, 0.4], [0.2, 0.1]] } };
      const anchor = labelAnchorPx(ann, W, H)!;
      // (0.3 - 0.2) * 1000 = 100, (0.4 - 0.1) * 500 = 150 — compared loosely
      // because subtracting normalized floats leaves the usual binary residue.
      expect(anchor[0]).toBeCloseTo(100, 6);
      expect(anchor[1]).toBeCloseTo(150, 6);
    });

    it("returns an anchor for the 2-point stored form", () => {
      const ann = { shape: { type: IMAGE_ELLIPSE, points: [[0.5, 0.5], [0.1, 0.1]] } };
      expect(labelAnchorPx(ann, W, H)).not.toBeNull();
    });

    it("does NOT require the 4-corner AABB form", () => {
      const twoPoint = { shape: { type: IMAGE_ELLIPSE, points: [[0.5, 0.5], [0.1, 0.1]] } };
      const anchor = labelAnchorPx(twoPoint, W, H)!;
      expect(anchor[0]).toBeCloseTo(400, 6);
      expect(anchor[1]).toBeCloseTo(200, 6);
    });

    it("accounts for rotation about the centroid", () => {
      // 200px x 200px in pixel space: rx = 0.1*1000 = 100, ry = 0.2*500 = 100.
      const ann = { shape: { type: IMAGE_ELLIPSE, points: [[0.4, 0.5], [0.1, 0.2]], angle: Math.PI / 4 } };
      const rotated = labelAnchorPx(ann, W, H)!;
      const half = 100 * Math.SQRT2;
      expect(rotated[0]).toBeCloseTo(400 - half, 6);
      expect(rotated[1]).toBeCloseTo(250 - half, 6);
    });

    it("treats angle 0 the same as no angle", () => {
      const pts = [[0.4, 0.5], [0.1, 0.2]];
      expect(labelAnchorPx({ shape: { type: IMAGE_ELLIPSE, points: pts, angle: 0 } }, W, H)).toEqual(
        labelAnchorPx({ shape: { type: IMAGE_ELLIPSE, points: pts } }, W, H),
      );
    });

    it("returns null when the radii point is missing", () => {
      expect(labelAnchorPx({ shape: { type: IMAGE_ELLIPSE, points: [[0.5, 0.5]] } }, W, H)).toBeNull();
      expect(labelAnchorPx({ shape: { type: IMAGE_ELLIPSE } }, W, H)).toBeNull();
    });
  });

  describe("circle", () => {
    it("subtracts the radius, normalized against min(w, h)", () => {
      const ann = { shape: { type: IMAGE_CIRCLE, points: [[0.5, 0.5]], radius: 0.1 } };
      // min(1000, 500) = 500, so r = 50px. Centre is (500, 250).
      expect(labelAnchorPx(ann, W, H)).toEqual([450, 200]);
    });

    it("treats a missing radius as zero", () => {
      const ann = { shape: { type: IMAGE_CIRCLE, points: [[0.5, 0.5]] } };
      expect(labelAnchorPx(ann, W, H)).toEqual([500, 250]);
    });

    it("returns null with no centre point", () => {
      expect(labelAnchorPx({ shape: { type: IMAGE_CIRCLE, points: [] } }, W, H)).toBeNull();
    });
  });

  describe("polygon and line", () => {
    it("takes the minimum x and y across polygon points", () => {
      const ann = { shape: { type: IMAGE_POLYGON, points: [[0.5, 0.9], [0.2, 0.5], [0.8, 0.3]] } };
      expect(labelAnchorPx(ann, W, H)).toEqual([200, 150]);
    });

    it("takes the upper-left of the two line endpoints", () => {
      const ann = { shape: { type: IMAGE_LINE, points: [[0.8, 0.2], [0.3, 0.9]] } };
      expect(labelAnchorPx(ann, W, H)).toEqual([300, 100]);
    });

    it("returns null for a degenerate line", () => {
      expect(labelAnchorPx({ shape: { type: IMAGE_LINE, points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });
  });

  describe("excluded and unknown shapes", () => {
    it("returns null for masks", () => {
      expect(labelAnchorPx({ shape: { type: IMAGE_MASK, points: [[0.1, 0.1], [0.5, 0.5]] } }, W, H)).toBeNull();
    });

    it("returns null for an unrecognised shape type", () => {
      expect(labelAnchorPx({ shape: { type: "idah-image:something-new", points: [[0.1, 0.1]] } }, W, H)).toBeNull();
    });

    it("returns null when there is no shape at all", () => {
      expect(labelAnchorPx({}, W, H)).toBeNull();
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
