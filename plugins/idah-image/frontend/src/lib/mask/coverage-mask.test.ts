// ---------------------------------------------------------------------------
// coverage-mask.test.ts — Tests for coverage mask utilities (clampRect)
// ---------------------------------------------------------------------------
import { describe, it, expect, vi } from "vitest";

import { clampRect } from "./coverage-mask";
import { flushDirtyTiles } from "./flush-tiles";

// ─── clampRect ─────────────────────────────────────────────────────────

describe("clampRect", () => {
  it("keeps a fully-inside rect unchanged", () => {
    expect(clampRect(10, 20, 100, 50, 800, 600)).toEqual([10, 20, 100, 50]);
  });

  it("drops the outside part when the rect starts beyond the left/top edge", () => {
    // [-10, 90) x [-5, 45) clipped to the image is [0, 90) x [0, 45)
    expect(clampRect(-10, -5, 100, 50, 800, 600)).toEqual([0, 0, 90, 45]);
  });

  it("clamps to media width/height when the rect extends beyond the right/bottom edge", () => {
    expect(clampRect(700, 500, 200, 200, 800, 600)).toEqual([700, 500, 100, 100]);
  });

  it("clips a rect spanning the whole image to the image", () => {
    expect(clampRect(-50, -50, 1000, 800, 800, 600)).toEqual([0, 0, 800, 600]);
  });

  it("returns 0 width/height when the rect is completely outside", () => {
    // Completely to the right/bottom
    expect(clampRect(900, 700, 100, 50, 800, 600)).toEqual([800, 600, 0, 0]);
    // Completely to the left/top: nothing of it lies inside the image
    expect(clampRect(-100, -100, 50, 50, 800, 600)).toEqual([0, 0, 0, 0]);
  });

  it("handles zero-width/height rects", () => {
    expect(clampRect(50, 50, 0, 0, 800, 600)).toEqual([50, 50, 0, 0]);
  });
});

// ─── flushDirtyTiles — buffer handling ────────────────────────────────

describe("flushDirtyTiles", () => {
  const annId = "ann-1";

  it("calls setShape for a single non-empty tile", async () => {
    const setShape = vi.fn();
    const getBuffer = () => new Uint8Array([255]); // non-empty

    await flushDirtyTiles(annId, ["0:0"], getBuffer, setShape);

    expect(setShape).toHaveBeenCalledOnce();
    const [id, key, value] = setShape.mock.calls[0];
    expect(id).toBe(annId);
    expect(key).toBe("tile-0x0");
    expect(value).toEqual({ rle: expect.any(String) });
  });

  it("calls setShapes when multiple tiles are dirty and setShapes is provided", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const buf = () => new Uint8Array([128]);
    const getBuffer = () => buf();

    await flushDirtyTiles(annId, ["0:0", "0:1"], getBuffer, setShape, setShapes);

    expect(setShapes).toHaveBeenCalledOnce();
    expect(setShape).not.toHaveBeenCalled();
  });

  it("passes null for a missing buffer (undefined) — tiles that were deleted by restoreSnapshots", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const getBuffer = () => undefined; // buffer was deleted

    // Use 2+ dirty tiles so writeTileEntries routes to setShapes
    await flushDirtyTiles(annId, ["0:0", "0:1"], getBuffer, setShape, setShapes);

    expect(setShapes).toHaveBeenCalledWith(annId, [
      { key: "tile-0x0", value: null },
      { key: "tile-0x1", value: null },
    ]);
  });

  it("passes null for an empty buffer (all zeros)", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const getBuffer = () => new Uint8Array(64 * 64); // zero-filled

    await flushDirtyTiles(annId, ["0:0", "1:0"], getBuffer, setShape, setShapes);

    expect(setShapes).toHaveBeenCalledWith(annId, [
      { key: "tile-0x0", value: null },
      { key: "tile-1x0", value: null },
    ]);
  });

  it("does nothing when dirtyTiles is empty", async () => {
    const setShape = vi.fn();
    await flushDirtyTiles(annId, [], () => new Uint8Array([1]), setShape);
    expect(setShape).not.toHaveBeenCalled();
  });

  it("falls back to individual setShape calls when setShapes is not provided", async () => {
    const setShape = vi.fn();
    const getBuffer = () => new Uint8Array([64]);

    await flushDirtyTiles(annId, ["0:0", "1:0"], getBuffer, setShape);

    expect(setShape).toHaveBeenCalledTimes(2);
    expect(setShape).toHaveBeenCalledWith(annId, "tile-0x0", { rle: expect.any(String) });
    expect(setShape).toHaveBeenCalledWith(annId, "tile-1x0", { rle: expect.any(String) });
  });

  it("mixed: some tiles with buffer, some without", async () => {
    const buffers = new Map<string, Uint8Array>([
      ["0:0", new Uint8Array([1])],
      // "0:1" has no buffer → undefined
    ]);
    const setShapes = vi.fn();

    await flushDirtyTiles(
      annId,
      ["0:0", "0:1"],
      (c, r) => buffers.get(`${c}:${r}`),
      vi.fn(),
      setShapes,
    );

    expect(setShapes).toHaveBeenCalledOnce();
    const entries = setShapes.mock.calls[0][1];
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ key: "tile-0x0", value: { rle: expect.any(String) } });
    expect(entries[1]).toEqual({ key: "tile-0x1", value: null });
  });
});
