// ---------------------------------------------------------------------------
// Grid math tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { tileKey, tileAt, tilesTouchedByCircle, tilesTouchedByPolygon } from "./grid";

describe("tileKey", () => {
  it("returns correct format", () => {
    expect(tileKey(0, 0)).toBe("tile-0x0");
    expect(tileKey(1, 2)).toBe("tile-1x2");
    expect(tileKey(5, 3)).toBe("tile-5x3");
  });
});

describe("tileAt", () => {
  it("returns tile (0, 0) for origin", () => {
    expect(tileAt(0, 0)).toEqual({ col: 0, row: 0 });
  });

  it("returns tile (1, 0) for pixel at x=64", () => {
    expect(tileAt(64, 0)).toEqual({ col: 1, row: 0 });
  });

  it("returns tile (1, 1) for pixel at x=64, y=64", () => {
    expect(tileAt(64, 64)).toEqual({ col: 1, row: 1 });
  });

  it("returns tile (0, 0) for pixel at x=63, y=63", () => {
    expect(tileAt(63, 63)).toEqual({ col: 0, row: 0 });
  });
});

describe("tilesTouchedByCircle", () => {
  it("returns single tile for a small circle fully inside tile 0", () => {
    const tiles = tilesTouchedByCircle(32, 32, 10);
    expect(tiles).toEqual([{ col: 0, row: 0 }]);
  });

  it("returns 4 tiles for a circle centered at tile boundary", () => {
    const tiles = tilesTouchedByCircle(64, 64, 10);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
    expect(tiles).toContainEqual({ col: 0, row: 1 });
    expect(tiles).toContainEqual({ col: 1, row: 1 });
  });

  it("returns 2 tiles for a circle straddling vertical boundary", () => {
    const tiles = tilesTouchedByCircle(63, 32, 5);
    expect(tiles).toHaveLength(2);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
  });

  it("returns tiles for a large circle spanning many tiles", () => {
    const tiles = tilesTouchedByCircle(128, 128, 100);
    // Should span from col/row 0 to 3+ (since 128-100=28 -> col 0; 128+100=228 -> col 3)
    expect(tiles.length).toBeGreaterThan(4);
  });
});

describe("tilesTouchedByPolygon", () => {
  it("returns empty array for empty points", () => {
    expect(tilesTouchedByPolygon([])).toEqual([]);
  });

  it("returns single tile for a small polygon in tile 0", () => {
    const tiles = tilesTouchedByPolygon([[10, 10], [20, 10], [15, 20]]);
    expect(tiles).toEqual([{ col: 0, row: 0 }]);
  });

  it("returns 4 tiles for a polygon spanning 4 tiles", () => {
    const tiles = tilesTouchedByPolygon([[10, 10], [100, 10], [100, 100], [10, 100]]);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
    expect(tiles).toContainEqual({ col: 0, row: 1 });
    expect(tiles).toContainEqual({ col: 1, row: 1 });
  });

  it("returns 2 tiles for a polygon straddling vertical boundary", () => {
    const tiles = tilesTouchedByPolygon([[60, 10], [70, 10], [70, 50], [60, 50]]);
    expect(tiles).toHaveLength(2);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
  });
});
