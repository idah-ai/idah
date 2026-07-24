// ---------------------------------------------------------------------------
// mask_shapes.flush.test.ts — Flush command tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted to avoid hoisting issues) ─────────────────────────

const { mockCreate, mockDelete, mockSetShape, mockSetShapes } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockSetShape: vi.fn(),
  mockSetShapes: vi.fn(),
}));

// State for the maskSession mock
let _mockAnnotationId: string | undefined = undefined;
let _mockDirtyTiles: string[] = [];
let _mockTileBuffers: Map<string, Uint8Array> = new Map();
let _mockMode: "add" | "remove" = "add";

// State for maskPolygonDraft mock
let _mockPoints: [number, number][] = [];
let _mockClosedPoints: [number, number][] | null = null;

// State for maskTool mock
let _mockMaskToolActive: string = "brush";

vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      items: [] as Array<{ id: string; shape: Record<string, unknown>; value?: Record<string, unknown> }>,
      create: mockCreate,
      delete: mockDelete,
      setShape: mockSetShape,
      setShapes: mockSetShapes,
    },
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => true,
}));

vi.mock("$lib/state/mask-session.svelte", () => ({
  maskSession: {
    get annotationId() { return _mockAnnotationId; },
    get dirty() { return new Set(_mockDirtyTiles); },
    get mode() { return _mockMode; },
    getTileBuffer: (col: number, row: number) => {
      const key = `${col}:${row}`;
      return _mockTileBuffers.get(key);
    },
    getDirtyTiles: () => _mockDirtyTiles,
    reset: () => {
      _mockDirtyTiles = [];
      _mockTileBuffers = new Map();
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get value() { return undefined; },
  },
}));

vi.mock("$lib/commands/mode/mask_polygon", () => ({
  maskPolygonDraft: {
    get points() { return _mockPoints; },
    set points(p: [number, number][]) { _mockPoints = p; },
    get closedPoints() { return _mockClosedPoints; },
    set closedPoints(p: [number, number][] | null) { _mockClosedPoints = p; },
  },
}));

vi.mock("$lib/state/mask-tool.svelte", () => ({
  maskTool: {
    get active() { return _mockMaskToolActive; },
    set active(v: string) { _mockMaskToolActive = v; },
  },
}));

// Import after mocks
import { command } from "./mask_shapes.flush";
import { MASK_TILE_SIZE } from "$lib/mask/constants";

function createEmptyBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
}

function createFullBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
}

function createSinglePixelBuffer(px: number, py: number): Uint8Array {
  const buf = createEmptyBuffer();
  buf[py * MASK_TILE_SIZE + px] = 1;
  return buf;
}

// ─── Integration-style tests using the register function ─────────────────

import { register } from "./mask_shapes.flush";

describe("annotation.mask_shapes.flush", () => {
  let mockDriver: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockAnnotationId = undefined;
    _mockDirtyTiles = [];
    _mockTileBuffers = new Map();
    _mockMode = "add";
    _mockPoints = [];
    _mockClosedPoints = null;
    _mockMaskToolActive = "brush";

    mockDriver = {
      command: {
        register: vi.fn(),
      },
      setMode: vi.fn(),
    };
  });

  it("registers the command on the driver", () => {
    register(mockDriver);
    expect(mockDriver.command.register).toHaveBeenCalledOnce();
    const registered = mockDriver.command.register.mock.calls[0][0];
    expect(registered.name).toBe("annotation.mask_shapes.flush");
  });

  describe("callback with dirty tiles", () => {
    it("writes a full tile as RLE and an empty tile as null", async () => {
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0", "0:1"];
      _mockTileBuffers.set("0:0", createFullBuffer());
      _mockTileBuffers.set("0:1", createEmptyBuffer());

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      await action.do();

      // Full tile should be upserted as RLE, empty tile deleted
      // Both are in the same batch call since there are 2 dirty tiles
      expect(mockSetShapes).toHaveBeenCalledWith(
        "ann-123",
        expect.arrayContaining([
          expect.objectContaining({ key: "tile-0x0", value: expect.objectContaining({ rle: expect.any(String) }) }),
          expect.objectContaining({ key: "tile-0x1", value: null }),
        ]),
      );
    });

    it("undo restores prior tile values", async () => {
      // Set up an existing annotation with prior tile data
      const existingData = {
        id: "ann-123",
        shape: {
          type: "idah-image:mask",
          "tile-0x0": { rle: "AA==" }, // prior: fully filled
          "tile-0x1": { rle: "" }, // prior: empty
        },
      };
      // Mock the data store
      const dataModule = await import("$lib/state/data.svelte");
      (dataModule.data.annotations as any).items = [existingData];

      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"]; // only modify tile 0x0
      _mockTileBuffers.set("0:0", createEmptyBuffer()); // new: empty tile

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // First do the flush
      await action.do();
      // Reset mock to track undo calls
      mockSetShape.mockClear();

      // Now undo
      await action.undo();

      // Undo should restore the prior value (full tile)
      expect(mockSetShape).toHaveBeenCalledWith(
        "ann-123",
        "tile-0x0",
        { rle: "AA==" },
      );

      // Undo should NOT delete the annotation
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("undo with no prior data sends null", async () => {
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());

      // No existing record -> no prior data
      const dataModule = await import("$lib/state/data.svelte");
      (dataModule.data.annotations as any).items = [];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // Do the flush
      await action.do();
      mockSetShape.mockClear();

      // Undo — since there was no prior data, it should send null
      await action.undo();

      expect(mockSetShape).toHaveBeenCalledWith(
        "ann-123",
        "tile-0x0",
        null,
      );
    });
  });

  describe("redo after undo", () => {
    it("re-applies the new values even after session reset", async () => {
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // Step 1: do() — writes full tile
      await action.do();
      expect(mockSetShape).toHaveBeenCalledWith(
        "ann-123",
        "tile-0x0",
        expect.objectContaining({ rle: expect.any(String) }),
      );

      // Step 2: undo() — restores prior (empty) state
      mockSetShape.mockClear();
      await action.undo();
      expect(mockSetShape).toHaveBeenCalledWith(
        "ann-123",
        "tile-0x0",
        null,  // no prior data → null
      );

      // Step 3: simulate redo — call do() on the same action again.
      // The session has been reset by the original do(), so
      // _mockDirtyTiles is empty and _mockTileBuffers has been
      // replaced with an empty buffer.  The newSnapshot captured
      // at callback-construction time should still have the
      // original new values, so redo writes the same tiles.
      _mockDirtyTiles = [];  // session was reset
      _mockTileBuffers.set("0:0", createEmptyBuffer());  // session cleared

      mockSetShape.mockClear();

      // Redo: call do() on the same action (the command manager
      // stores the action, not the callback).
      await action.do();
      expect(mockSetShape).toHaveBeenCalledWith(
        "ann-123",
        "tile-0x0",
        expect.objectContaining({ rle: expect.any(String) }),
      );
    });
  });

  describe("mask polygon close snapshot (closedPoints fix)", () => {
    it("captures closedPoints at callback creation time and clears the shared global", () => {
      // Arrange: simulate a polygon close that set closedPoints
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];

      // Act: create the command while closedPoints is still set
      const action = registered.callback();

      // The callback returns early (noopAction) because there are no dirty tiles.
      // We need a scenario where the flush has dirty tiles AND closedPoints is set.
      // Set up the full scenario:
    });

    it("flush from polygon close restores polygon preview on undo", async () => {
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // closedPoints should be cleared at callback time
      expect(_mockClosedPoints).toBeNull();

      // Undo should restore the polygon preview
      await action.undo();

      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
      expect(_mockMaskToolActive).toBe("polygon");
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]);
    });

    it("undo without polygonCloseSnapshot does not restore polygon preview", async () => {
      // Arrange: closedPoints is null — this is a normal brush flush
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());
      _mockClosedPoints = null;

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // Undo should NOT restore polygon preview
      await action.undo();

      expect(mockDriver.setMode).not.toHaveBeenCalled();
      expect(_mockMaskToolActive).toBe("brush");
      expect(_mockPoints).toEqual([]);
    });

    it("second flush command created after polygon close does not see closedPoints", async () => {
      // Regression test: two flush commands in sequence, only the first one
      // should see the non-null closedPoints.

      _mockAnnotationId = "ann-123";
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];

      // First command captures the close
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());

      const firstAction = registered.callback();
      expect(_mockClosedPoints).toBeNull();

      // Second command (created after the close — e.g. a later brush stroke)
      _mockDirtyTiles = ["0:1"];
      _mockTileBuffers.set("0:1", createFullBuffer());

      const secondAction = registered.callback();

      // Undo the second command — it should NOT restore polygon preview
      await secondAction.undo();
      expect(mockDriver.setMode).not.toHaveBeenCalled();
      expect(_mockMaskToolActive).toBe("brush");
      expect(_mockPoints).toEqual([]);

      // Undo the first command — it SHOULD restore polygon preview
      await firstAction.undo();
      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
      expect(_mockMaskToolActive).toBe("polygon");
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]);
    });

    it("undo/redo cycle multiple times is idempotent with local snapshot", async () => {
      _mockAnnotationId = "ann-123";
      _mockDirtyTiles = ["0:0"];
      _mockTileBuffers.set("0:0", createFullBuffer());
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback();

      // First undo (after do that cleared points)
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);

      // Redo (do again) -> clears points
      _mockPoints = [];
      await action.do();
      expect(_mockPoints).toEqual([]);

      // Undo again -> should still restore polygon preview
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);

      // Redo -> clear again
      _mockPoints = [];
      await action.do();
      expect(_mockPoints).toEqual([]);

      // One more undo for good measure
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    });
  });
});
