import { describe, it, expect } from "vitest";
import { isTileKey, stripTileKeys, extractTileEntries } from "./strip-tile-keys";

describe("isTileKey", () => {
  it("returns true for a valid tile key", () => {
    expect(isTileKey("tile-0x0")).toBe(true);
    expect(isTileKey("tile-12x34")).toBe(true);
    expect(isTileKey("tile-999x999")).toBe(true);
  });

  it("returns false for non-tile keys", () => {
    expect(isTileKey("type")).toBe(false);
    expect(isTileKey("tile-")).toBe(false);
    expect(isTileKey("tile-x0")).toBe(false);
    expect(isTileKey("tile-0x")).toBe(false);
    expect(isTileKey("tile-abc")).toBe(false);
    expect(isTileKey("something-0x0")).toBe(false);
  });
});

describe("stripTileKeys", () => {
  it("removes tile keys from a shape object", () => {
    const shape = { type: "idah-image:mask", "tile-0x0": { rle: "ABC" }, "tile-0x1": { rle: "DEF" } };
    const result = stripTileKeys(shape);
    expect(result).toEqual({ type: "idah-image:mask" });
    expect(result).not.toHaveProperty("tile-0x0");
    expect(result).not.toHaveProperty("tile-0x1");
  });

  it("preserves non-tile keys", () => {
    const shape = { type: "idah-image:mask", x: 10, y: 20, width: 100, height: 200 };
    const result = stripTileKeys(shape);
    expect(result).toEqual({ type: "idah-image:mask", x: 10, y: 20, width: 100, height: 200 });
  });

  it("does not mutate the original object", () => {
    const shape = { type: "idah-image:mask", "tile-0x0": { rle: "ABC" } };
    const copy = { ...shape };
    stripTileKeys(shape);
    expect(shape).toEqual(copy);
  });

  it("returns an empty object when given only tile keys", () => {
    const shape = { "tile-0x0": { rle: "ABC" }, "tile-1x1": { rle: "DEF" } };
    expect(stripTileKeys(shape)).toEqual({});
  });
});

describe("extractTileEntries", () => {
  it("extracts tile entries from a shape", () => {
    const shape = { type: "idah-image:mask", "tile-0x0": { rle: "ABC" }, "tile-0x1": { rle: "DEF" } };
    const entries = extractTileEntries(shape);
    expect(entries).toEqual([
      { key: "tile-0x0", value: { rle: "ABC" } },
      { key: "tile-0x1", value: { rle: "DEF" } },
    ]);
  });

  it("returns empty array when no tile keys exist", () => {
    const shape = { type: "idah-image:mask", x: 10, y: 20 };
    expect(extractTileEntries(shape)).toEqual([]);
  });

  it("returns empty array for empty shape", () => {
    expect(extractTileEntries({})).toEqual([]);
  });
});