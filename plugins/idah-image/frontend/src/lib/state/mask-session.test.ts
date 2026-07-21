// ---------------------------------------------------------------------------
// mask-session.test.ts — Tests for mask session state
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from "vitest";
import { maskSession } from "./mask-session.svelte";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { encode } from "$lib/mask/rle";
import { paintCircle } from "$lib/mask/raster";

describe("maskSession", () => {
  beforeEach(() => {
    maskSession.reset();
  });

  describe("beginSession", () => {
    it("sets the annotation id and clears previous state", () => {
      maskSession.beginSession("ann-1");
      expect(maskSession.annotationId).toBe("ann-1");
      expect(maskSession.dirty.size).toBe(0);
      expect(maskSession.tileBuffers.size).toBe(0);
    });

    it("resets state when called again", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);

      maskSession.beginSession("ann-2");
      expect(maskSession.annotationId).toBe("ann-2");
      expect(maskSession.dirty.size).toBe(0);
      expect(maskSession.tileBuffers.size).toBe(0);
    });

    it("accepts undefined annotation id (new mask)", () => {
      maskSession.beginSession(undefined);
      expect(maskSession.annotationId).toBeUndefined();
    });
  });

  describe("setMode", () => {
    it("defaults to add", () => {
      expect(maskSession.mode).toBe("add");
    });

    it("switches to remove", () => {
      maskSession.setMode("remove");
      expect(maskSession.mode).toBe("remove");
    });

    it("switches back to add", () => {
      maskSession.setMode("remove");
      maskSession.setMode("add");
      expect(maskSession.mode).toBe("add");
    });
  });

  describe("ensureTileBuffer", () => {
    beforeEach(() => {
      maskSession.beginSession("ann-1");
    });

    it("creates a new empty buffer for a tile", () => {
      const buf = maskSession.ensureTileBuffer(0, 0);
      expect(buf.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
      expect(buf.every((v) => v === 0)).toBe(true);
    });

    it("returns the same buffer on subsequent calls", () => {
      const buf1 = maskSession.ensureTileBuffer(0, 0);
      const buf2 = maskSession.ensureTileBuffer(0, 0);
      expect(buf1).toBe(buf2);
    });

    it("creates separate buffers for different tiles", () => {
      const buf1 = maskSession.ensureTileBuffer(0, 0);
      const buf2 = maskSession.ensureTileBuffer(1, 0);
      expect(buf1).not.toBe(buf2);
    });

    it("hydrates from existing RLE data", () => {
      // Create a buffer with a painted pixel, encode it
      const source = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
      source[0] = 1;
      const rle = encode(source, MASK_TILE_SIZE, MASK_TILE_SIZE);

      const buf = maskSession.ensureTileBuffer(0, 0, rle);
      expect(buf[0]).toBe(1);
      expect(buf.subarray(1).every((v) => v === 0)).toBe(true);
    });
  });

  describe("markDirty and dirty tracking", () => {
    beforeEach(() => {
      maskSession.beginSession("ann-1");
    });

    it("starts with no dirty tiles", () => {
      expect(maskSession.dirty.size).toBe(0);
    });

    it("marks a tile as dirty", () => {
      maskSession.markDirty(0, 0);
      expect(maskSession.dirty.has("0:0")).toBe(true);
    });

    it("marks multiple tiles as dirty", () => {
      maskSession.markDirty(0, 0);
      maskSession.markDirty(1, 1);
      expect(maskSession.dirty.size).toBe(2);
    });

    it("getDirtyTiles returns all dirty tile keys", () => {
      maskSession.markDirty(0, 0);
      maskSession.markDirty(1, 1);
      const tiles = maskSession.getDirtyTiles();
      expect(tiles).toContain("0:0");
      expect(tiles).toContain("1:1");
      expect(tiles.length).toBe(2);
    });
  });

  describe("getTileBuffer", () => {
    beforeEach(() => {
      maskSession.beginSession("ann-1");
    });

    it("returns undefined for a tile that has not been touched", () => {
      expect(maskSession.getTileBuffer(0, 0)).toBeUndefined();
    });

    it("returns the buffer for a tile that has been ensured", () => {
      const buf = maskSession.ensureTileBuffer(0, 0);
      expect(maskSession.getTileBuffer(0, 0)).toBe(buf);
    });
  });

  describe("reset", () => {
    it("clears all state (mode is persistent, not reset)", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);
      maskSession.setMode("remove");

      maskSession.reset();

      expect(maskSession.annotationId).toBeUndefined();
      expect(maskSession.tileBuffers.size).toBe(0);
      expect(maskSession.dirty.size).toBe(0);
      // Mode is intentionally NOT reset — it's a persistent user preference
      expect(maskSession.mode).toBe("remove");
    });
  });

  describe("simulated paint/erase sequence", () => {
    it("tracks exactly the touched tiles after a sequence of operations", () => {
      maskSession.beginSession("ann-1");

      // Simulate painting on tile (0,0) and (0,1)
      const buf00 = maskSession.ensureTileBuffer(0, 0);
      paintCircle(buf00, 0, 0, 32, 32, 10, "add");
      maskSession.markDirty(0, 0);

      const buf01 = maskSession.ensureTileBuffer(0, 1);
      paintCircle(buf01, 0, 64, 32, 96, 10, "add");
      maskSession.markDirty(0, 1);

      expect(maskSession.dirty.size).toBe(2);
      expect(maskSession.dirty.has("0:0")).toBe(true);
      expect(maskSession.dirty.has("0:1")).toBe(true);

      // Verify buffers have painted pixels
      expect(maskSession.getTileBuffer(0, 0)!.some((v) => v === 1)).toBe(true);
      expect(maskSession.getTileBuffer(0, 1)!.some((v) => v === 1)).toBe(true);
    });

    it("discards session on reset without leaving residual state", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);

      maskSession.reset();

      // Start a new session — should be clean
      maskSession.beginSession("ann-2");
      expect(maskSession.dirty.size).toBe(0);
      expect(maskSession.tileBuffers.size).toBe(0);
    });
  });
});
