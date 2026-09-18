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

  it("returns tile (1, 0) for pixel at x=128", () => {
    expect(tileAt(128, 0)).toEqual({ col: 1, row: 0 });
  });

  it("returns tile (1, 1) for pixel at x=128, y=128", () => {
    expect(tileAt(128, 128)).toEqual({ col: 1, row: 1 });
  });

  it("returns tile (0, 0) for pixel at x=127, y=127", () => {
    expect(tileAt(127, 127)).toEqual({ col: 0, row: 0 });
  });
});

describe("tilesTouchedByCircle", () => {
  it("returns single tile for a small circle fully inside tile 0", () => {
    const tiles = tilesTouchedByCircle(32, 32, 10);
    expect(tiles).toEqual([{ col: 0, row: 0 }]);
  });

  it("returns 4 tiles for a circle centered at tile boundary", () => {
    const tiles = tilesTouchedByCircle(128, 128, 10);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
    expect(tiles).toContainEqual({ col: 0, row: 1 });
    expect(tiles).toContainEqual({ col: 1, row: 1 });
  });

  it("returns 2 tiles for a circle straddling vertical boundary", () => {
    const tiles = tilesTouchedByCircle(127, 32, 5);
    expect(tiles).toHaveLength(2);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
  });

  it("returns tiles for a large circle spanning many tiles", () => {
    const tiles = tilesTouchedByCircle(256, 256, 200);
    // Radius 200 from center 256 covers 56 to 456 → tiles from col 0 to col 3 (4 columns)
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
    const tiles = tilesTouchedByPolygon([[10, 10], [200, 10], [200, 200], [10, 200]]);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
    expect(tiles).toContainEqual({ col: 0, row: 1 });
    expect(tiles).toContainEqual({ col: 1, row: 1 });
  });

  it("returns 2 tiles for a polygon straddling vertical boundary", () => {
    const tiles = tilesTouchedByPolygon([[120, 10], [136, 10], [136, 50], [120, 50]]);
    expect(tiles).toHaveLength(2);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 0 });
  });
});
