// ---------------------------------------------------------------------------
// add.test.ts — Annotation creation command tests (mask-specific paths)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────

const { mockCreate, mockDelete, mockSetShape, mockSetShapes, mockSelectAnnotation } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockSetShape: vi.fn(),
  mockSetShapes: vi.fn(),
  mockSelectAnnotation: vi.fn(),
}));

// State for maskPolygonDraft mock
let _mockPoints: [number, number][] = [];
let _mockClosedPoints: [number, number][] | null = null;

// State for maskTool mock
let _mockMaskToolActive: string = "brush";

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
      setShapes: mockSetShapes,
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
    _mockPoints = [];
    _mockClosedPoints = null;
    _mockMaskToolActive = "brush";

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

    // Should have flushed tiles via setShapes (batched, since 2 dirty tiles)
    expect(mockSetShapes).toHaveBeenCalledWith(
      "generated-uuid-123",
      expect.arrayContaining([
        expect.objectContaining({ key: "tile-0x0", value: expect.objectContaining({ rle: expect.any(String) }) }),
        expect.objectContaining({ key: "tile-0x1", value: null }),
      ]),
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

  describe("mask polygon close snapshot (closedPoints fix)", () => {
    it("captures closedPoints at callback creation time and clears the shared global", async () => {
      // Arrange: simulate a polygon close that set closedPoints
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];

      // Act: create the command while closedPoints is still set
      const action = registered.callback({
        shape: { type: "idah-image:mask" },
        value: { category: "cat" },
      });

      // Assert: the shared global was cleared at callback time
      expect(_mockClosedPoints).toBeNull();

      // Undo (async — it calls await data.annotations.delete)
      await action.undo();

      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
      expect(_mockMaskToolActive).toBe("polygon");
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]);
    });

    it("undo without polygonCloseSnapshot does not restore polygon preview", async () => {
      // Arrange: closedPoints is null — this is a normal mask creation (e.g. brush)
      _mockClosedPoints = null;

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({
        shape: { type: "idah-image:mask" },
        value: { category: "cat" },
      });

      // Act: do then undo
      mockCreate.mockResolvedValue({ id: "ann-1" });
      await action.do();
      mockDelete.mockClear();
      mockDriver.setMode.mockClear();
      await action.undo();

      // Assert: no polygon-restoration side effects
      expect(mockDriver.setMode).not.toHaveBeenCalledWith("idah-image:mask");
      expect(_mockMaskToolActive).toBe("brush");
      expect(_mockPoints).toEqual([]);
    });

    it("second command created after polygon close does not see closedPoints", async () => {
      // This is the regression test for the bug: two commands in sequence,
      // only the first one's creation should see a non-null closedPoints.

      // Arrange: simulate a polygon close
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];

      // First command captures the close
      const firstAction = registered.callback({
        shape: { type: "idah-image:mask" },
        value: { category: "cat" },
      });
      // closedPoints should be null now
      expect(_mockClosedPoints).toBeNull();

      // Second command (created after the close — e.g. a later brush stroke)
      const secondAction = registered.callback({
        shape: { type: "idah-image:mask" },
        value: { category: "cat" },
      });

      // Undo the second command — it should NOT restore polygon preview
      await secondAction.undo();
      expect(mockDriver.setMode).not.toHaveBeenCalled();
      expect(_mockMaskToolActive).toBe("brush");
      expect(_mockPoints).toEqual([]);

      // Undo the first command — it SHOULD restore polygon preview
      mockDriver.setMode.mockClear();
      await firstAction.undo();
      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
      expect(_mockMaskToolActive).toBe("polygon");
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]);
    });

    it("undo/redo cycle multiple times is idempotent with local snapshot", async () => {
      _mockClosedPoints = [[0.1, 0.2], [0.3, 0.4]];

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({
        shape: { type: "idah-image:mask" },
        value: { category: "cat" },
      });

      // First undo — should restore polygon preview
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);

      // Redo (do again) — clears points
      _mockPoints = [];
      await action.do();
      expect(_mockPoints).toEqual([]);

      // Undo again — should still restore polygon preview (local snapshot reused)
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);

      // Redo — clear again
      _mockPoints = [];
      await action.do();
      expect(_mockPoints).toEqual([]);

      // One more undo for good measure
      await action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    });
  });
});
