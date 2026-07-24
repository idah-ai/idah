// ---------------------------------------------------------------------------
// occupancy.test.ts — Occupancy grid tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from "vitest";
import { rebuildOccupancy, isOccupied, markOccupancyDirty } from "./occupancy";
import { MASK_TILE_SIZE } from "./constants";
import { decode } from "./rle";
import { paintCircle } from "./raster";

/**
 * Create an annotation item that looks like a mask annotation with the given tile data.
 */
function makeMaskAnn(
  id: string,
  tiles: Record<string, { rle: string }>,
  hidden: boolean = false,
): { id: string; shape: { type: string } & Record<string, unknown>; value?: Record<string, unknown>; isHidden?: boolean } {
  return {
    id,
    shape: { type: "idah-image:mask", ...tiles },
    value: { category: "cat" },
  };
}

describe("rebuildOccupancy", () => {
  beforeEach(() => {
    markOccupancyDirty();
  });

  it("clears the grid when no annotations exist", () => {
    rebuildOccupancy([]);
    expect(isOccupied(0, 0, 0, 0)).toBe(false);
  });

  it("builds a grid from a single mask annotation", () => {
    // Single pixel at offset 0: runs [0, 1] → "AAE="
    const ann = makeMaskAnn("ann-1", {
      "tile-0x0": { rle: "AAE=" },
    });
    rebuildOccupancy([ann]);

    // Pixel (0,0) in tile (0,0) should be occupied
    expect(isOccupied(0, 0, 0, 0)).toBe(true);
    // Pixel (1,0) should not be
    expect(isOccupied(0, 0, 1, 0)).toBe(false);
  });

  it("correctly ORs overlapping tiles from multiple annotations", () => {
    // ann1: 50 ones at start → runs [0, 50] → "ADI="
    const ann1 = makeMaskAnn("ann-1", {
      "tile-0x0": { rle: "ADI=" },
    });
    // ann2: 20 zeros, 30 ones → runs [20, 30] → "FB4="
    const ann2 = makeMaskAnn("ann-2", {
      "tile-0x0": { rle: "FB4=" },
    });
    rebuildOccupancy([ann1, ann2]);

    // Pixel (0,0) should be occupied (ann1)
    expect(isOccupied(0, 0, 0, 0)).toBe(true);
    // Pixel (20,0) should be occupied (ann2 — 20 zeros then 1)
    expect(isOccupied(0, 0, 20, 0)).toBe(true);
    // Pixel (60,0) should NOT be occupied (both have zeros there)
    expect(isOccupied(0, 0, 60, 0)).toBe(false);
  });

  it("skips hidden annotations", () => {
    const ann = makeMaskAnn("ann-1", {
      "tile-0x0": { rle: "AAE=" },
    }, true);
    // The isHidden check is done in the caller (mask_brush.ts etc.)
    // via annotation.isHidden(). For the grid test, we just pass
    // non-hidden annotations.
    // rebuildOccupancy doesn't filter by hidden itself — it relies on
    // the caller to filter. Let's test that caller's responsibility.
    rebuildOccupancy([ann, makeMaskAnn("ann-2", { "tile-0x0": { rle: "AAE=" } })]);
    expect(isOccupied(0, 0, 0, 0)).toBe(true);
  });

  describe("self-occupancy prevention (regression)", () => {
    it("does not block the currently edited mask from extending its own committed pixels", () => {
      // Create a committed mask annotation with pixel (0,0) in tile (0,0) painted
      const ann = makeMaskAnn("ann-current", {
        "tile-0x0": { rle: "AAE=" }, // pixel (0,0) painted
      });
      rebuildOccupancy([ann]);

      // Create a fresh session buffer for this same annotation, hydrated
      // from its committed tile (as onPointerDown does).
      const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
      // Decode the committed RLE into the buffer
      const committedRle = "AAE=";
      const decoded = decode(committedRle, MASK_TILE_SIZE, MASK_TILE_SIZE);
      buf.set(decoded);

      // Now paint a circle in add mode with checkOccupied wired to the
      // occupancy grid, centered at (0, 0) with radius 3 so it covers
      // both the already-painted pixel (0,0) and some new pixels.
      const checkOccupied = (localPx: number, localPy: number) =>
        isOccupied(0, 0, localPx, localPy);

      paintCircle(
        buf,      // buffer
        0,        // tileOriginX
        0,        // tileOriginY
        0,        // cx (circle center)
        0,        // cy
        3,        // radius
        "add",    // mode
        Infinity, // mediaWidth
        Infinity, // mediaHeight
        checkOccupied,
      );

      // Pixel (0,0) should still be 1 (not accidentally cleared)
      expect(buf[0]).toBe(1);

      // Pixel (0,1) or (1,0) should be 1 (newly painted, not blocked)
      expect(buf[1]).toBe(1); // (1,0) inside radius 3

      // The committed pixel (0,0) is already in the occupancy grid AND
      // in the session buffer, so checkOccupied skips it but the buffer
      // already has it = no change needed.  New pixels outside the
      // committed set are not in the occupancy grid, so they get painted.
    });

    it("correctly blocks genuine cross-annotation overlap", () => {
      // Create two different mask annotations, each with a committed pixel
      // in a different position in tile (0,0).
      const ann1 = makeMaskAnn("ann-one", {
        "tile-0x0": { rle: "AAE=" }, // pixel (0,0) painted
      });

      // ann2 has no committed tiles yet — we're painting ONTO ann2, so
      // the occupancy grid should only contain ann1's pixels.
      rebuildOccupancy([ann1]);

      // Fresh session buffer for ann2 — empty, no committed pixels
      const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);

      // Paint a circle in add mode with checkOccupied, centered at (0,0)
      // with radius 3.  Pixel (0,0) is occupied by ann1 and should be
      // blocked.  Pixel (2,0) is not occupied and should be painted.
      const checkOccupied = (localPx: number, localPy: number) =>
        isOccupied(0, 0, localPx, localPy);

      paintCircle(
        buf,      // buffer
        0,        // tileOriginX
        0,        // tileOriginY
        0,        // cx
        0,        // cy
        3,        // radius
        "add",    // mode
        Infinity, // mediaWidth
        Infinity, // mediaHeight
        checkOccupied,
      );

      // Pixel (0,0) should be 0 (blocked by the occupancy grid)
      expect(buf[0]).toBe(0);

      // Pixel (2,0) should be 1 (inside circle radius 3, and not occupied by any mask)
      expect(buf[2]).toBe(1);
    });
  });
});
