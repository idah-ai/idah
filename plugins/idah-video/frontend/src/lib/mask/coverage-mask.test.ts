// ---------------------------------------------------------------------------
// coverage-mask.test.ts — Tests for buildTileEntries
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { MASK_TILE_SIZE } from "./constants";
import { buildTileEntries, clampRect, subtractRectFromShapes } from "./coverage-mask";
import { decode } from "./rle";

describe("buildTileEntries", () => {
  it("returns empty array for empty rects", () => {
    const entries = buildTileEntries([]);
    expect(entries).toEqual([]);
  });

  it("returns empty array for empty rects with existing tile keys (deletes them)", () => {
    const entries = buildTileEntries([], new Set(["0:0", "1:2"]));
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ key: "tile-0x0", value: null });
    expect(entries).toContainEqual({ key: "tile-1x2", value: null });
  });

  it("returns a single entry for a rect fully inside tile (0,0)", () => {
    // 10x10 rect at (10, 10) → fully inside tile (0,0)
    const entries = buildTileEntries([[10, 10, 20, 20]]);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("tile-0x0");
    expect(entries[0].value).not.toBeNull();
    expect((entries[0].value as { rle: string }).rle).toBeTruthy();
  });

  it("returns entries for rects spanning multiple tiles", () => {
    // 200x200 rect at (10, 10) → spans tiles (0,0), (0,1), (1,0), (1,1)
    const entries = buildTileEntries([[10, 10, 200, 200]]);
    expect(entries).toHaveLength(4);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("tile-0x0");
    expect(keys).toContain("tile-0x1");
    expect(keys).toContain("tile-1x0");
    expect(keys).toContain("tile-1x1");
    entries.forEach((e) => {
      expect(e.value).not.toBeNull();
      expect((e.value as { rle: string }).rle).toBeTruthy();
    });
  });

  it("deletes stale tiles not in current rects", () => {
    const existing = new Set<string>(["0:0", "3:5"]);
    // Only tile (0,0) is touched by the new rect
    const entries = buildTileEntries([[10, 10, 50, 50]], existing);
    expect(entries).toHaveLength(2);
    // tile-0x0 is upserted
    const upsert = entries.find((e) => e.key === "tile-0x0");
    expect(upsert).toBeDefined();
    expect(upsert!.value).not.toBeNull();
    // tile-3x5 is deleted
    const deleted = entries.find((e) => e.key === "tile-3x5");
    expect(deleted).toBeDefined();
    expect(deleted!.value).toBeNull();
  });

  it("does not delete tiles that overlap current rects", () => {
    const existing = new Set<string>(["0:0", "1:1"]);
    const entries = buildTileEntries([[10, 10, 200, 200]], existing);
    // Touches tiles (0,0), (0,1), (1,0), (1,1)
    // (1,1) is in existing and also touched → upsert, not delete
    const tile11 = entries.find((e) => e.key === "tile-1x1");
    expect(tile11).toBeDefined();
    expect(tile11!.value).not.toBeNull(); // upserted
    // (0,0) is in existing and touched → upsert, not delete
    const tile00 = entries.find((e) => e.key === "tile-0x0");
    expect(tile00).toBeDefined();
    expect(tile00!.value).not.toBeNull();
  });

  it("handles multiple rects correctly", () => {
    // Two separate rects: one in (0,0), one in (2,2)
    const entries = buildTileEntries([
      [10, 10, 50, 50],   // tile (0,0)
      [300, 300, 60, 60], // tile (2,2)
    ]);
    expect(entries).toHaveLength(2);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("tile-0x0");
    expect(keys).toContain("tile-2x2");
    entries.forEach((e) => {
      expect(e.value).not.toBeNull();
    });
  });

  it("produces valid RLE that can be decoded", () => {
    const entries = buildTileEntries([[10, 10, 50, 50]]);
    expect(entries).toHaveLength(1);
    const rle = (entries[0].value as { rle: string }).rle;
    expect(rle).toBeTruthy();

    // Verify round-trip: decode the RLE and check buffer dimensions
    const buffer = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(buffer.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    // At least some pixels should be painted
    const painted = buffer.reduce((sum: number, v: number) => sum + v, 0);
    expect(painted).toBeGreaterThan(0);
  });
describe("clampRect", () => {
  it("clamps negative x/y to 0", () => {
    const [cx, cy, cw, ch] = clampRect(-10, -20, 100, 200, 640, 480);
    expect(cx).toBe(0);
    expect(cy).toBe(0);
    expect(cw).toBe(100);
    expect(ch).toBe(200);
  });

  it("clamps width/height to media bounds", () => {
    const [cx, cy, cw, ch] = clampRect(600, 400, 100, 200, 640, 480);
    expect(cx).toBe(600);
    expect(cy).toBe(400);
    expect(cw).toBe(40);  // 640 - 600
    expect(ch).toBe(80);  // 480 - 400
  });

  it("returns 0 width/height when fully outside", () => {
    const [cx, cy, cw, ch] = clampRect(700, 500, 100, 200, 640, 480);
    expect(cx).toBe(640);
    expect(cy).toBe(480);
    expect(cw).toBe(0);
    expect(ch).toBe(0);
  });

  it("passes through valid rect unchanged", () => {
    const [cx, cy, cw, ch] = clampRect(10, 20, 100, 200, 640, 480);
    expect(cx).toBe(10);
    expect(cy).toBe(20);
    expect(cw).toBe(100);
    expect(ch).toBe(200);
  });
});

describe("subtractRectFromShapes", () => {
  it("returns empty for empty input", () => {
    expect(subtractRectFromShapes([], 0, 0, 10, 10)).toEqual([]);
  });

  it("keeps shapes not overlapping the eraser", () => {
    const shapes = [{ type: "bbox", points: [0, 0, 10, 10] }, { type: "bbox", points: [100, 100, 10, 10] }];
    const result = subtractRectFromShapes(shapes, 50, 50, 10, 10);
    expect(result).toHaveLength(2);
  });

  it("removes a shape fully covered by the eraser", () => {
    const shapes = [{ type: "bbox", points: [5, 5, 10, 10] }];
    const result = subtractRectFromShapes(shapes, 0, 0, 100, 100);
    expect(result).toHaveLength(0);
  });

  it("splits a shape when eraser overlaps the middle", () => {
    const shapes = [{ type: "bbox", points: [0, 0, 100, 100] }];
    const result = subtractRectFromShapes(shapes, 25, 25, 50, 50);
    // Should produce up to 4 pieces: top, bottom, left, right
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("splits a shape when eraser overlaps the top edge", () => {
    const shapes = [{ type: "bbox", points: [0, 0, 100, 100] }];
    const result = subtractRectFromShapes(shapes, 0, 0, 50, 30);
    // Should produce bottom piece + left/right
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("handles non-bbox shapes by keeping them", () => {
    const shapes = [{ type: "bbox", points: [0, 0, 10, 10] }, { type: "circle", points: [50, 50, 10] }];
    const result = subtractRectFromShapes(shapes, 0, 0, 100, 100);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("circle");
  });
});
});
