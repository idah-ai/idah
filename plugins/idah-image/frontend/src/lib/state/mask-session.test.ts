// ---------------------------------------------------------------------------
// mask-session.test.ts — Tests for mask session state
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest";
import { maskSession } from "./mask-session.svelte";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { encode } from "$lib/mask/rle";
import { paintCircle } from "$lib/mask/raster";
import { IMAGE_MASK } from "$lib/types";

// ---------------------------------------------------------------------------
// Driver mock — handlePopoverCancel calls viewport.mode setter, which calls
// getDriver().setMode().  We mock the driver so the test doesn't need a real
// one.
// ---------------------------------------------------------------------------
const mockSetMode = vi.fn();
vi.mock("$lib/state/driver.svelte", () => ({
  getDriver: () => ({ setMode: mockSetMode, onModeChange: vi.fn() }),
  syncStatus: { queued: 0, error: null },
}));

// Import the real handlePopoverCancel after mocks are set up
import { handlePopoverCancel } from "$lib/components/App/ImageAnnotationWorkspace/popover-cancel";

describe("maskSession", () => {
  beforeEach(() => {
    maskSession.reset();
    vi.clearAllMocks();
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

    it("continues (preserves buffers) when called with the same annotation id", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);

      maskSession.beginSession("ann-1");
      expect(maskSession.annotationId).toBe("ann-1");
      expect(maskSession.dirty.size).toBe(1);
      expect(maskSession.tileBuffers.size).toBe(1);
    });

    it("accepts undefined annotation id (new mask)", () => {
      maskSession.beginSession(undefined);
      expect(maskSession.annotationId).toBeUndefined();
    });

    it("beginSession(undefined) ALWAYS clears without continuePending, even if previous session was also undefined", () => {
      // Start a new-mask session (undefined id)
      maskSession.beginSession(undefined, { continuePending: true });
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);
      expect(maskSession.tileBuffers.size).toBe(1);
      expect(maskSession.dirty.size).toBe(1);

      // A second undefined-id call WITHOUT continuePending — should clear
      maskSession.beginSession(undefined);
      expect(maskSession.tileBuffers.size).toBe(0);
      expect(maskSession.dirty.size).toBe(0);
      expect(maskSession.annotationId).toBeUndefined();
    });

    it("beginSession(undefined, { continuePending: true }) preserves buffers when previous session was also undefined", () => {
      maskSession.beginSession(undefined, { continuePending: true });
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);

      // Continue the same pending new-mask attempt
      maskSession.beginSession(undefined, { continuePending: true });
      expect(maskSession.tileBuffers.size).toBe(1);
      expect(maskSession.dirty.size).toBe(1);
    });

    it("clears _tileVersions on session boundary", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);
      // access to internal state via getTileVersion
      expect(maskSession.getTileVersion("0:0")).toBeGreaterThanOrEqual(0);

      maskSession.beginSession("ann-2");
      // Version should be reset for the new session
      expect(maskSession.getTileVersion("0:0")).toBe(-1);
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

    it("clears _tileVersions", () => {
      maskSession.beginSession("ann-1");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);
      expect(maskSession.getTileVersion("0:0")).toBeGreaterThanOrEqual(0);

      maskSession.reset();
      expect(maskSession.getTileVersion("0:0")).toBe(-1);
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

  describe("handlePopoverCancel — real code path", () => {
    it("popup cancel + restart: second new-mask session is clean", () => {
      // Step 1: User paints a new mask (undefined annotationId)
      maskSession.beginSession(undefined, { continuePending: true });
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);
      expect(maskSession.tileBuffers.size).toBe(1);

      // Step 2: User cancels the category popup — this calls the REAL handler
      // extracted from ImageAnnotationWorkspace.svelte.  If this handler
      // were missing maskSession.reset(), the next session would inherit
      // the first attempt's buffers — the test would fail.
      handlePopoverCancel(
        [IMAGE_MASK, [], undefined],
        {
          setAnnotationValue: vi.fn(),
          setPendingValue: vi.fn(),
          clearShapeSelectionArgs: vi.fn(),
          setShowPopOver: vi.fn(),
          selectAnnotation: vi.fn(),
        },
      );

      // Step 3: User starts a new mask — should be clean
      maskSession.beginSession(undefined, { continuePending: true });
      expect(maskSession.tileBuffers.size).toBe(0);
      expect(maskSession.dirty.size).toBe(0);
    });
  });

  describe("_tileVersions does not grow unboundedly across sessions", () => {
    it("stays bounded after multiple begin/reset cycles touching the same tiles", () => {
      // Perform several cycles of begin → paint → reset, touching the same
      // tile coordinates each time. The _tileVersions map should never have
      // more than one entry per unique tile coordinate touched in the current
      // session — it should be cleared at each boundary.
      const cycles = 5;
      for (let i = 0; i < cycles; i++) {
        maskSession.beginSession(`ann-${i}`);
        maskSession.ensureTileBuffer(i, 0);
        maskSession.markDirty(i, 0);
        maskSession.ensureTileBuffer(0, i);
        maskSession.markDirty(0, i);
        // After reset, tileVersions is cleared — so the next cycle starts fresh
        maskSession.reset();
      }

      // After all cycles and a final reset, start a new session touching
      // only one tile — the version map should only have entries for tiles
      // touched in THIS session (via ensureTileBuffer and markDirty).
      maskSession.beginSession("final");
      maskSession.ensureTileBuffer(0, 0);
      maskSession.markDirty(0, 0);

      // The renderer iterates tileBuffers, so stale versions don't render.
      // But verify that getTileVersion returns -1 for tiles not touched
      // in the current session, confirming no stale entries leak.
      for (let i = 1; i < cycles; i++) {
        expect(maskSession.getTileVersion(`${i}:0`)).toBe(-1);
        expect(maskSession.getTileVersion(`0:${i}`)).toBe(-1);
      }
      // The tile we did touch in this session should have a version >= 0
      expect(maskSession.getTileVersion("0:0")).toBeGreaterThanOrEqual(0);
    });
  });
});