// ---------------------------------------------------------------------------
// Raster operations tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { paintCircle, fillPolygon, isEmpty } from "./raster";
import { MASK_TILE_SIZE } from "./constants";

function createEmptyBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
}

describe("paintCircle", () => {
  it("paints a circle in add mode", () => {
    const buf = createEmptyBuffer();
    paintCircle(buf, 0, 0, 32, 32, 10, "add");
    expect(buf.some((v) => v === 1)).toBe(true);
  });

  it("add then remove over the same region returns to empty", () => {
    const buf = createEmptyBuffer();
    paintCircle(buf, 0, 0, 32, 32, 10, "add");
    paintCircle(buf, 0, 0, 32, 32, 10, "remove");
    expect(buf.every((v) => v === 0)).toBe(true);
  });

  it("overlapping add strokes don't double-count (values stay 0/1)", () => {
    const buf = createEmptyBuffer();
    paintCircle(buf, 0, 0, 32, 32, 10, "add");
    paintCircle(buf, 0, 0, 35, 35, 10, "add");
    expect(buf.every((v) => v === 0 || v === 1)).toBe(true);
  });

  it("does not paint outside the tile bounds", () => {
    const buf = createEmptyBuffer();
    // Paint a circle far from the tile
    paintCircle(buf, 0, 0, 200, 200, 10, "add");
    expect(buf.every((v) => v === 0)).toBe(true);
  });
});

describe("fillPolygon", () => {
  it("fills a triangle in add mode", () => {
    const buf = createEmptyBuffer();
    fillPolygon(buf, 0, 0, [[10, 10], [50, 10], [30, 50]], "add");
    expect(buf.some((v) => v === 1)).toBe(true);
  });

  it("add then remove over the same region returns to empty", () => {
    const buf = createEmptyBuffer();
    fillPolygon(buf, 0, 0, [[10, 10], [50, 10], [30, 50]], "add");
    fillPolygon(buf, 0, 0, [[10, 10], [50, 10], [30, 50]], "remove");
    expect(buf.every((v) => v === 0)).toBe(true);
  });

  it("does nothing with fewer than 3 points", () => {
    const buf = createEmptyBuffer();
    fillPolygon(buf, 0, 0, [[10, 10], [20, 20]], "add");
    expect(buf.every((v) => v === 0)).toBe(true);
  });
});

describe("isEmpty", () => {
  it("returns true for an empty buffer", () => {
    expect(isEmpty(createEmptyBuffer())).toBe(true);
  });

  it("returns false for a buffer with a painted pixel", () => {
    const buf = createEmptyBuffer();
    buf[0] = 1;
    expect(isEmpty(buf)).toBe(false);
  });

  it("returns false for a fully-filled buffer", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
    expect(isEmpty(buf)).toBe(false);
  });
});
