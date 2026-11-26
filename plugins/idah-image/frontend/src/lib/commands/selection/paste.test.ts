// ---------------------------------------------------------------------------
// paste.test.ts — Integration tests for idah-image:selection.paste
//
// Drives the real paste.ts (and batch_move.ts) against mocked data/selection/
// viewport/editor stores. Verifies that redo reuses the ids generated at
// callback time (restore, never re-create), so later actions on the redo
// stack (move, delete, update) still refer to the same annotations.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clipboard } from "$lib/state/clipboard.svelte";
import { register as registerPaste } from "./paste";
import { register as registerBatchMove } from "./batch_move";

// ── Hoisted mutable state for mocks ────────────────────────────────────────
const mockCreateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockDeleteFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockRestoreFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockUpdateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockSelectAnnotations = vi.hoisted(() => vi.fn());
const mockDeselect = vi.hoisted(() => vi.fn());
const mockCursor = vi.hoisted(() => [0.5, 0.5] as [number, number]);
const mockUuidv7 = vi.hoisted(() => {
  let counter = 0;
  return vi.fn(() => `test-uuid-${counter++}`);
});
const mockRegister = vi.hoisted(() => vi.fn());

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      create: mockCreateFn,
      delete: mockDeleteFn,
      restore: mockRestoreFn,
      update: mockUpdateFn,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get selectedAnnotations() {
      return [] as any[];
    },
    selectAnnotations: mockSelectAnnotations,
    deselect: mockDeselect,
  },
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {
    cursor: mockCursor,
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => true,
}));

vi.mock("uuidv7", () => ({
  uuidv7: mockUuidv7,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function registerCommands(): {
  pasteCallback: (...args: any[]) => any;
  batchMoveCallback: (...args: any[]) => any;
} {
  const result: any = {};
  mockRegister.mockImplementation((opts: any) => {
    if (opts.name === "idah-image:selection.paste") {
      result.pasteCallback = opts.callback;
    } else if (opts.name === "idah-image:selection.batch-move") {
      result.batchMoveCallback = opts.callback;
    }
  });
  const mockDriver = {
    command: { register: mockRegister },
    workflowStep: "annotate",
  };
  registerPaste(mockDriver as any);
  registerBatchMove(mockDriver as any);
  return result;
}

function resetMocks(): void {
  mockCreateFn.mockReset();
  mockCreateFn.mockResolvedValue({ id: "created" });
  mockDeleteFn.mockReset();
  mockDeleteFn.mockResolvedValue(undefined);
  mockRestoreFn.mockReset();
  mockRestoreFn.mockResolvedValue({ id: "restored" });
  mockUpdateFn.mockReset();
  mockUpdateFn.mockResolvedValue(undefined);
  mockSelectAnnotations.mockReset();
  mockDeselect.mockReset();
  mockUuidv7.mockReset();
  mockRegister.mockReset();
  clipboard.clear();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("idah-image:selection.paste", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("do → undo → do creates once, then restores with the same ids", async () => {
    clipboard.store(
      [
        {
          shape_type: "idah-image:bounding-box",
          shape_args: {
            points: [
              [0, 0],
              [10, 10],
            ],
          },
          category: "test/cat",
          properties: undefined,
          metadata: undefined,
          centroidOffset: [0, 0],
        },
      ],
      [0, 0],
    );

    const { pasteCallback } = registerCommands();
    const action = pasteCallback();

    await action.do();
    expect(mockCreateFn).toHaveBeenCalledTimes(1);
    const createdId = mockCreateFn.mock.calls[0][0].id;

    // Undo deletes the created annotation
    mockCreateFn.mockClear();
    await action.undo!();
    expect(mockDeleteFn).toHaveBeenCalledWith(createdId);

    // Redo restores the same id, never re-creates
    mockDeleteFn.mockClear();
    await action.do();
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
    expect(mockRestoreFn.mock.calls[0][0].id).toBe(createdId);
  });

  it("paste → batch move → undo both → redo both updates the restored ids", async () => {
    clipboard.store(
      [
        {
          shape_type: "idah-image:bounding-box",
          shape_args: {
            points: [
              [0, 0],
              [10, 10],
            ],
          },
          category: "test/cat",
          properties: undefined,
          metadata: undefined,
          centroidOffset: [0, 0],
        },
      ],
      [0, 0],
    );

    const { pasteCallback, batchMoveCallback } = registerCommands();
    const pasteAction = pasteCallback();
    await pasteAction.do();

    const createdId = mockCreateFn.mock.calls[0][0].id;
    const createdShape = mockCreateFn.mock.calls[0][0].shape_args;

    // Batch move the pasted annotation
    const moveAction = batchMoveCallback({
      updates: [
        {
          annotationId: createdId,
          shape: {
            points: [
              [5, 5],
              [6, 6],
            ],
          },
          snapshot: {
            id: createdId,
            shape_type: "idah-image:bounding-box",
            shape_args: createdShape,
            category: "test/cat",
          },
        },
      ],
    });
    await moveAction.do();
    expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    expect(mockUpdateFn.mock.calls[0][0].id).toBe(createdId);

    // Undo both (move first, then paste)
    mockUpdateFn.mockClear();
    await moveAction.undo!();
    await pasteAction.undo!();

    // Redo both (paste first, then move)
    mockCreateFn.mockClear();
    mockRestoreFn.mockClear();
    mockUpdateFn.mockClear();
    await pasteAction.do();
    await moveAction.do();

    // Paste restored the same id (no new create)
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
    expect(mockRestoreFn.mock.calls[0][0].id).toBe(createdId);

    // Move updated the restored id — no failure
    expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    expect(mockUpdateFn.mock.calls[0][0].id).toBe(createdId);
  });
});
