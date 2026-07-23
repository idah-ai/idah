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

    mockDriver = {
      command: {
        register: vi.fn(),
      },
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
});
