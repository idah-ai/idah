// ---------------------------------------------------------------------------
// BoundingBox/utils.spec.ts — Unit tests for bounding-box utility functions
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  clampRect,
  boundingBoxHandle,
  rotatePointN,
  inverseRotatePointN,
  handleCursor,
  rotatedCursorSVG,
  rotateCursorSVG,
} from "./utils";

// ─── clampRect ────────────────────────────────────────────────────────────

describe("clampRect", () => {
  const W = 1920;
  const H = 1080;

  it("clamps axis-aligned (angle=0) points to [0,1]", () => {
    const pts: [number, number][] = [
      [-0.1, 0.3],
      [1.2, 0.3],
      [1.2, 0.7],
      [-0.1, 0.7],
    ];
    const result = clampRect(W, H, pts, 0, pts);
    expect(result[0][0]).toBe(0);
    expect(result[1][0]).toBe(1);
    expect(result[2][0]).toBe(1);
    expect(result[3][0]).toBe(0);
  });

  it("returns original points when rotated and at least one corner is inside [0,1]", () => {
    // A rotated bbox with one corner inside
    const pts: [number, number][] = [
      [0.5, 0.5],
      [0.6, 0.4],
      [0.7, 0.5],
      [0.6, 0.6],
    ];
    const result = clampRect(W, H, pts, Math.PI / 4, pts);
    expect(result).toBe(pts); // identity
  });

  it("returns origPoints when rotated and no corners are inside [0,1]", () => {
    const pts: [number, number][] = [
      [-0.5, -0.5],
      [-0.4, -0.6],
      [-0.3, -0.5],
      [-0.4, -0.4],
    ];
    const orig: [number, number][] = [
      [0.1, 0.1],
      [0.2, 0.1],
      [0.2, 0.2],
      [0.1, 0.2],
    ];
    const result = clampRect(W, H, pts, Math.PI / 4, orig);
    expect(result).toBe(orig);
  });

  it("passes through valid axis-aligned points unchanged", () => {
    const pts: [number, number][] = [
      [0.2, 0.3],
      [0.5, 0.3],
      [0.5, 0.6],
      [0.2, 0.6],
    ];
    const result = clampRect(W, H, pts, 0, pts);
    expect(result[0][0]).toBeCloseTo(0.2);
    expect(result[1][0]).toBeCloseTo(0.5);
  });
});

// ─── boundingBoxHandle ────────────────────────────────────────────────────

describe("boundingBoxHandle", () => {
  it("returns 8 handle positions for 4 points", () => {
    const pts: [number, number][] = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ];
    const handles = boundingBoxHandle(pts);
    expect(handles).toHaveLength(8);
    // Corners at even indices (0,2,4,6)
    expect(handles[0]).toEqual([0.1, 0.2]); // tl
    expect(handles[2]).toEqual([0.5, 0.2]); // tr
    expect(handles[4]).toEqual([0.5, 0.6]); // br
    expect(handles[6]).toEqual([0.1, 0.6]); // bl
    // Edge midpoints at odd indices
    expect(handles[1]).toEqual([0.3, 0.2]); // tm
    expect(handles[3]).toEqual([0.5, 0.4]); // mr
    expect(handles[5]).toEqual([0.3, 0.6]); // bm
    expect(handles[7]).toEqual([0.1, 0.4]); // ml
  });

  it("returns empty array when fewer than 4 points", () => {
    expect(boundingBoxHandle([[0, 0], [1, 0], [1, 1]])).toEqual([]);
    expect(boundingBoxHandle([])).toEqual([]);
  });
});

// ─── rotatePointN / inverseRotatePointN ───────────────────────────────────

describe("rotatePointN", () => {
  it("rotates a normalized point around a center in pixel space", () => {
    const point: [number, number] = [0.6, 0.5];
    const center: [number, number] = [0.5, 0.5];
    // 90° CW around center: (0.1*1920, 0) → (0, -0.1*1080) in pixel space,
    // then back to normalized: should be (0.5, 0.5) since it rotates (0.1*1920, 0) to (0, -0.1*1920)
    // Actually: point=[0.6,0.5] → pixel=[1152,540]. center pixel=[960,540].
    // Rotate (192, 0) by 90° → (0, 192) = [960, 732] = normalized [0.5, 0.6778]
    const result = rotatePointN(point, center, Math.PI / 2, 1920, 1080);
    expect(result[0]).toBeCloseTo(0.5, 3);
    expect(result[1]).toBeCloseTo((540 + 192) / 1080, 3);
  });

  it("returns identity when angle is 0", () => {
    const point: [number, number] = [0.3, 0.7];
    const center: [number, number] = [0.5, 0.5];
    const result = rotatePointN(point, center, 0, 1920, 1080);
    expect(result[0]).toBeCloseTo(point[0]);
    expect(result[1]).toBeCloseTo(point[1]);
  });
});

describe("inverseRotatePointN", () => {
  it("inverts rotatePointN", () => {
    const point: [number, number] = [0.6, 0.5];
    const center: [number, number] = [0.5, 0.5];
    const angle = Math.PI / 6;
    const rotated = rotatePointN(point, center, angle, 1920, 1080);
    const restored = inverseRotatePointN(rotated, center, angle, 1920, 1080);
    expect(restored[0]).toBeCloseTo(point[0], 5);
    expect(restored[1]).toBeCloseTo(point[1], 5);
  });
});

// ─── handleCursor ─────────────────────────────────────────────────────────

describe("handleCursor", () => {
  it("returns correct cursor for each handle index 0-7", () => {
    const expected = [
      "nwse-resize", // 0: tl
      "ns-resize",   // 1: tm
      "nesw-resize", // 2: tr
      "ew-resize",   // 3: mr
      "nwse-resize", // 4: br
      "ns-resize",   // 5: bm
      "nesw-resize", // 6: bl
      "ew-resize",   // 7: ml
    ];
    for (let i = 0; i < 8; i++) {
      expect(handleCursor(i)).toBe(expected[i]);
    }
  });

  it("returns 'grab' for out-of-range indices", () => {
    expect(handleCursor(-1)).toBe("grab");
    expect(handleCursor(8)).toBe("grab");
    expect(handleCursor(99)).toBe("grab");
  });
});

// ─── rotatedCursorSVG ─────────────────────────────────────────────────────

describe("rotatedCursorSVG", () => {
  it("returns a data URL starting with data:image/svg+xml", () => {
    const url = rotatedCursorSVG(0, 0, "#FF0000");
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("includes the rotation angle in the SVG transform", () => {
    const url = rotatedCursorSVG(0, Math.PI / 4, "#00FF00");
    const decoded = atob(url.split(",")[1]);
    expect(decoded).toContain("rotate(45");
  });

  it("includes the stroke color in the SVG", () => {
    const url = rotatedCursorSVG(0, 0, "#FF0000");
    const decoded = atob(url.split(",")[1]);
    expect(decoded).toContain("#FF0000");
  });

  it("generates different cursors for different handle indices", () => {
    const url0 = rotatedCursorSVG(0, 0, "#000");
    const url2 = rotatedCursorSVG(2, 0, "#000");
    expect(url0).not.toBe(url2);
  });
});

// ─── rotateCursorSVG ──────────────────────────────────────────────────────

describe("rotateCursorSVG", () => {
  it("returns a data URL starting with data:image/svg+xml", () => {
    const url = rotateCursorSVG("#FF0000");
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("includes the stroke color", () => {
    const url = rotateCursorSVG("#00FF00");
    const decoded = atob(url.split(",")[1]);
    expect(decoded).toContain("#00FF00");
  });
});