// ---------------------------------------------------------------------------
// hit-test.test.ts — Hit-testing tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { isMaskPixelPainted, hitTestMaskLayer } from "./hit-test";
import { MASK_TILE_SIZE } from "./constants";

describe("isMaskPixelPainted", () => {
  it("returns true for a painted pixel", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[0] = 1; // top-left pixel of tile
    expect(isMaskPixelPainted(buf, 0, 0, 0, 0)).toBe(true);
  });

  it("returns false for an unpainted pixel", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(isMaskPixelPainted(buf, 0, 0, 10, 10)).toBe(false);
  });

  it("returns false for a pixel outside the tile bounds", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    // Pixel at (64, 0) is in tile (1, 0), not tile (0, 0)
    expect(isMaskPixelPainted(buf, 0, 0, 64, 0)).toBe(false);
  });

  it("correctly checks a pixel in tile (1, 0)", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[0] = 1; // top-left of tile (1, 0)
    expect(isMaskPixelPainted(buf, 1, 0, 128, 0)).toBe(true);
  });
});

describe("hitTestMaskLayer", () => {
  it("returns null when no annotations match", () => {
    const result = hitTestMaskLayer(
      10, 10,
      [],
      () => false,
      () => [255, 0, 0, 100],
    );
    expect(result.annotationId).toBeNull();
    expect(result.annotation).toBeNull();
  });

  it("returns null when the pixel is not painted", () => {
    const anns = [{
      id: "ann-1",
      shape: { type: "idah-image:mask" },
    }];
    const result = hitTestMaskLayer(
      10, 10,
      anns,
      () => false,
      () => [255, 0, 0, 100],
    );
    expect(result.annotationId).toBeNull();
  });

  it("skips hidden annotations", () => {
    const anns = [{
      id: "ann-1",
      shape: { type: "idah-image:mask", "tile-0x0": { rle: "" } },
    }];
    const result = hitTestMaskLayer(
      0, 0,
      anns,
      () => true, // hidden
      () => [255, 0, 0, 100],
    );
    expect(result.annotationId).toBeNull();
  });
});
