// ---------------------------------------------------------------------------
// add.test.ts — Annotation creation command tests (mask-specific paths)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────

const { mockCreate, mockDelete, mockSetShape, mockSelectAnnotation } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockSetShape: vi.fn(),
  mockSelectAnnotation: vi.fn(),
}));

// State for the maskSession mock
let _mockAnnotationId: string | undefined = undefined;
let _mockDirtyTiles: string[] = [];
let _mockTileBuffers: Map<string, Uint8Array> = new Map();
let _mockResetCalled = false;

vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      items: [] as Array<{ id: string; shape: Record<string, unknown>; value?: Record<string, unknown> }>,
      create: mockCreate,
      delete: mockDelete,
      setShape: mockSetShape,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    selectAnnotation: mockSelectAnnotation,
    get value() { return undefined; },
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => true,
}));

vi.mock("$lib/state/mask-session.svelte", () => ({
  maskSession: {
    get annotationId() { return _mockAnnotationId; },
    get dirty() { return new Set(_mockDirtyTiles); },
    get mode() { return "add" as const; },
    getTileBuffer: (col: number, row: number) => {
      const key = `${col}:${row}`;
      return _mockTileBuffers.get(key);
    },
    getDirtyTiles: () => _mockDirtyTiles,
    reset: () => { _mockResetCalled = true; },
  },
}));

vi.mock("uuidv7", () => ({
  uuidv7: () => "generated-uuid-123",
}));

// Import after mocks
import { register } from "./add";
import { MASK_TILE_SIZE } from "$lib/mask/constants";

function createEmptyBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
}

function createFullBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
}

describe("annotation.add (mask path)", () => {
  let mockDriver: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockAnnotationId = undefined;
    _mockDirtyTiles = [];
    _mockTileBuffers = new Map();
    _mockResetCalled = false;

    mockCreate.mockResolvedValue({ id: "created-ann-id" });

    mockDriver = {
      command: { register: vi.fn() },
      setMode: vi.fn(),
      toolbar: { invalidate: vi.fn() },
      config: {},
    };
  });

  it("creates a mask annotation and flushes pre-painted session tiles", async () => {
    // Set up session with pre-painted tiles (no annotationId yet — brand new mask)
    _mockDirtyTiles = ["0:0", "0:1"];
    _mockTileBuffers.set("0:0", createFullBuffer());    // non-empty → upsert
    _mockTileBuffers.set("0:1", createEmptyBuffer());   // empty → delete

    register(mockDriver);
    const registered = mockDriver.command.register.mock.calls[0][0];
    const action = registered.callback({
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    await action.do();

    // Should have created the annotation
    expect(mockCreate).toHaveBeenCalledWith({
      id: "generated-uuid-123",
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    // Should have flushed tiles via setShape
    expect(mockSetShape).toHaveBeenCalledWith(
      "generated-uuid-123",
      "tile-0x0",
      expect.objectContaining({ rle: expect.any(String) }),
    );
    expect(mockSetShape).toHaveBeenCalledWith(
      "generated-uuid-123",
      "tile-0x1",
      null,
    );

    // Session should have been reset
    expect(_mockResetCalled).toBe(true);
  });

  it("undo deletes the annotation (cascade cleans up tiles)", async () => {
    _mockDirtyTiles = ["0:0"];
    _mockTileBuffers.set("0:0", createFullBuffer());

    register(mockDriver);
    const registered = mockDriver.command.register.mock.calls[0][0];
    const action = registered.callback({
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    // Do the creation
    await action.do();
    expect(mockCreate).toHaveBeenCalled();

    // Undo
    mockDelete.mockClear();
    await action.undo();

    // Should have deleted the annotation (cascade handles tile cleanup)
    expect(mockDelete).toHaveBeenCalledWith("generated-uuid-123");
  });

  it("does not flush tiles when session has no dirty tiles", async () => {
    _mockDirtyTiles = [];  // no pre-painted tiles

    register(mockDriver);
    const registered = mockDriver.command.register.mock.calls[0][0];
    const action = registered.callback({
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    await action.do();

    // Annotation was created
    expect(mockCreate).toHaveBeenCalled();
    // No tiles were flushed
    expect(mockSetShape).not.toHaveBeenCalled();
  });

  it("undo does not add mask-specific tile restoration (relies on cascade)", async () => {
    // Verify the undo path was NOT modified to add mask-specific
    // tile-restoration logic — deleting the annotation is sufficient.
    _mockDirtyTiles = ["0:0"];
    _mockTileBuffers.set("0:0", createFullBuffer());

    register(mockDriver);
    const registered = mockDriver.command.register.mock.calls[0][0];
    const action = registered.callback({
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    await action.do();
    mockDelete.mockClear();
    mockSetShape.mockClear();
    await action.undo();

    // Only delete was called — no setShape calls for tile restoration
    expect(mockDelete).toHaveBeenCalled();
    expect(mockSetShape).not.toHaveBeenCalled();
  });
});
