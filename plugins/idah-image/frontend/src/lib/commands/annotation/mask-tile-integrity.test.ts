// ---------------------------------------------------------------------------
// mask-tile-integrity.test.ts — End-to-end regression test for tile key
// integrity across create/flush/delete/undo/redo cycles.
//
// Asserts that no create() or update() call ever includes tile-shaped keys
// (tile-{col}x{row}) in its shape/dimensions payload at any point in the
// sequence, while confirming setShape/setShapes did receive the expected
// tile entries at the expected points.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted to avoid hoisting issues) ─────────────────────────

const { mockCreate, mockDelete, mockUpdate, mockSetShape, mockSetShapes, mockSelectAnnotation } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetShape: vi.fn(),
  mockSetShapes: vi.fn(),
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
      update: mockUpdate,
      setShape: mockSetShape,
      setShapes: mockSetShapes,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    selectAnnotation: mockSelectAnnotation,
    deselect: vi.fn(),
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

vi.mock("$lib/mask/tile-cache", () => ({
  invalidateAll: vi.fn(),
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: { isReviewWorkspace: false },
}));

// Import after mocks
import { register as registerAdd } from "./add";
import { register as registerDelete } from "./delete";
import { register as registerFlush } from "./mask_shapes.flush";
import { MASK_TILE_SIZE } from "$lib/mask/constants";

function createEmptyBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
}

function createFullBuffer(): Uint8Array {
  return new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
}

/**
 * Assert that a create/update call argument's shape contains no tile-* keys.
 */
function expectNoTileKeysInShape(shape: unknown): void {
  if (shape && typeof shape === "object") {
    for (const key of Object.keys(shape as Record<string, unknown>)) {
      expect(key).not.toMatch(/^tile-\d+x\d+$/);
    }
  }
}

/**
 * Assert that every create() and update() call captured by the mock
 * has no tile keys in its shape/dimensions payload.
 */
function expectNoTileKeysInAnyCreateOrUpdate(): void {
  for (const call of mockCreate.mock.calls) {
    const payload = call[0] as Record<string, unknown>;
    if (payload.shape) expectNoTileKeysInShape(payload.shape);
  }
  for (const call of mockUpdate.mock.calls) {
    const payload = call[0] as Record<string, unknown>;
    if (payload.shape) expectNoTileKeysInShape(payload.shape);
  }
}

describe("mask tile integrity — full undo/redo cycle", () => {
  let mockDriver: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockAnnotationId = undefined;
    _mockDirtyTiles = [];
    _mockTileBuffers = new Map();
    _mockResetCalled = false;

    mockCreate.mockResolvedValue({ id: "generated-uuid-123" });
    mockDelete.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockSetShape.mockResolvedValue(undefined);
    mockSetShapes.mockResolvedValue(undefined);

    mockDriver = {
      command: { register: vi.fn() },
      setMode: vi.fn(),
      toolbar: { invalidate: vi.fn() },
      config: {},
    };

    // Register all commands
    registerAdd(mockDriver);
    registerDelete(mockDriver);
    registerFlush(mockDriver);
  });

  function getRegistered(name: string) {
    const calls = mockDriver.command.register.mock.calls;
    for (const [cmd] of calls) {
      if (cmd.name === name) return cmd;
    }
    throw new Error(`Command ${name} not registered`);
  }

  it("never leaks tile keys into create/update across create → flush → delete → undo → redo → undo", async () => {
    // ── Step 1: Create a mask annotation with 2 pre-painted tiles ──
    _mockDirtyTiles = ["0:0", "0:1"];
    _mockTileBuffers.set("0:0", createFullBuffer());    // non-empty
    _mockTileBuffers.set("0:1", createEmptyBuffer());    // empty → null

    const addCmd = getRegistered("annotation.add");
    const addAction = addCmd.callback({
      shape: { type: "idah-image:mask" },
      value: { category: "cat" },
    });

    await addAction.do();

    // The create() call must NOT contain tile keys
    expectNoTileKeysInAnyCreateOrUpdate();
    // Tiles were flushed via setShape
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

    // ── Step 2: Flush additional tile changes ──
    // Simulate the annotation now existing in the store with its tiles
    const dataModule = await import("$lib/state/data.svelte");
    (dataModule.data.annotations as any).items = [{
      id: "generated-uuid-123",
      shape: {
        type: "idah-image:mask",
        "tile-0x0": { rle: "FULL_TILE" },
        "tile-0x1": null,
      },
    }];

    _mockAnnotationId = "generated-uuid-123";
    _mockDirtyTiles = ["0:0"]; // modify tile 0x0
    _mockTileBuffers.set("0:0", createEmptyBuffer()); // new: empty

    mockSetShape.mockClear();
    mockSetShapes.mockClear();

    const flushCmd = getRegistered("annotation.mask_shapes.flush");
    const flushAction = flushCmd.callback();

    await flushAction.do();

    // No create/update calls should have tile keys
    expectNoTileKeysInAnyCreateOrUpdate();
    // The flush should have written via setShape
    expect(mockSetShape).toHaveBeenCalledWith(
      "generated-uuid-123",
      "tile-0x0",
      null,
    );

    // ── Step 3: Delete the annotation ──
    mockSetShape.mockClear();
    mockSetShapes.mockClear();
    mockCreate.mockClear();
    mockDelete.mockClear();

    const deleteCmd = getRegistered("annotation.delete");
    const deleteAction = deleteCmd.callback({
      annotationId: "generated-uuid-123",
    });

    await deleteAction.do();

    // Delete should have called the driver's delete
    expect(mockDelete).toHaveBeenCalledWith("generated-uuid-123");
    // No tile keys in any create/update
    expectNoTileKeysInAnyCreateOrUpdate();

    // ── Step 4: Undo the delete (recreate via recreateAnnotationWithTiles) ──
    mockDelete.mockClear();
    mockCreate.mockClear();
    mockSetShape.mockClear();
    mockSetShapes.mockClear();

    await deleteAction.undo();

    // The recreate must call create() WITHOUT tile keys in shape
    expect(mockCreate).toHaveBeenCalled();
    const createCall = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expectNoTileKeysInShape(createCall.shape);
    // The create call must have the id preserved
    expect(createCall.id).toBe("generated-uuid-123");
    // Non-tile shape fields must be preserved
    expect((createCall.shape as any)?.type).toBe("idah-image:mask");
    // Tiles must be restored via setShape/setShapes
    expect(mockSetShapes).toHaveBeenCalledWith(
      "generated-uuid-123",
      expect.arrayContaining([
        expect.objectContaining({ key: "tile-0x0", value: null }),
      ]),
    );

    // ── Step 5: Redo the delete ──
    mockDelete.mockClear();
    mockCreate.mockClear();
    mockSetShape.mockClear();
    mockSetShapes.mockClear();

    await deleteAction.do();

    // Redo delete: should call delete, no tile keys in create/update
    expect(mockDelete).toHaveBeenCalledWith("generated-uuid-123");
    expectNoTileKeysInAnyCreateOrUpdate();

    // ── Step 6: Undo the delete again ──
    mockDelete.mockClear();
    mockCreate.mockClear();
    mockSetShape.mockClear();
    mockSetShapes.mockClear();

    await deleteAction.undo();

    // Second undo: same assertions as first undo
    expect(mockCreate).toHaveBeenCalled();
    const createCall2 = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expectNoTileKeysInShape(createCall2.shape);
    expect(createCall2.id).toBe("generated-uuid-123");
    expect(mockSetShapes).toHaveBeenCalled();

    // Final sanity: no tile keys ever leaked at any point
    expectNoTileKeysInAnyCreateOrUpdate();
  });
});