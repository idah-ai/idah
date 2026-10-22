// ---------------------------------------------------------------------------
// add.test.ts — Integration tests for annotation.add
//
// Drives the real add.ts against mocked data/selection/viewport/editor stores.
// Verifies that redo restores (never re-creates) the annotation, since deletes
// are soft and create() is a plain insert.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { register as registerAdd } from "./add";

// ── Hoisted mutable state for mocks ────────────────────────────────────────
const mockCreateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockRestoreFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockDeleteFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockSelectAnnotation = vi.hoisted(() => vi.fn());
const mockIsEditable = vi.hoisted(() => vi.fn(() => true));
const mockCurrentFrameValue = vi.hoisted(() => ({ value: 0 }));
const mockSetMode = vi.hoisted(() => vi.fn());
const mockCommandCall = vi.hoisted(() => vi.fn());
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
      restore: mockRestoreFn,
      delete: mockDeleteFn,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    selectAnnotation: mockSelectAnnotation,
  },
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {
    video: { currentFrame: mockCurrentFrameValue },
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => mockIsEditable(),
}));

vi.mock("./polygon.add_point.svelte", () => ({
  draft: { points: [] },
}));

vi.mock("uuidv7", () => ({
  uuidv7: mockUuidv7,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function registerCommands(): { addCallback: (...args: any[]) => any } {
  const result: any = {};
  mockRegister.mockImplementation((opts: any) => {
    if (opts.name === "idah-video:annotation.add") {
      result.addCallback = opts.callback;
    }
  });
  const mockDriver = {
    command: { register: mockRegister, call: mockCommandCall },
    setMode: mockSetMode,
    workflowStep: "annotate",
  };
  registerAdd(mockDriver as any);
  return result;
}

function resetMocks(): void {
  mockCreateFn.mockReset();
  mockCreateFn.mockResolvedValue({ id: "created" });
  mockRestoreFn.mockReset();
  // Resolve to a record carrying the original id, like the real store now does.
  mockRestoreFn.mockImplementation((record: any) => Promise.resolve({ ...record }));
  mockDeleteFn.mockReset();
  mockDeleteFn.mockResolvedValue(undefined);
  mockSelectAnnotation.mockReset();
  mockIsEditable.mockReset();
  mockIsEditable.mockReturnValue(true);
  mockCurrentFrameValue.value = 0;
  mockSetMode.mockReset();
  mockCommandCall.mockReset();
  mockUuidv7.mockReset();
  mockRegister.mockReset();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("annotation.add", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("do → undo → do calls create once, then restore once with the same id", async () => {
    const { addCallback } = registerCommands();
    const action = addCallback({
      shape_type: "idah-video:bounding-box",
      shape: {
        start: 0,
        end: 4,
        frames: [
          {
            frame: 0,
            angle: 0,
            points: [
              [0, 0],
              [10, 10],
            ],
          },
        ],
      },
      category: "test/cat",
    });

    // First run: create
    await action.do();
    expect(mockCreateFn).toHaveBeenCalledTimes(1);
    const created = mockCreateFn.mock.calls[0][0];
    expect(created.id).toBe("test-uuid-0");

    // Undo: soft-deletes
    mockCreateFn.mockClear();
    mockRestoreFn.mockClear();
    await action.undo!();
    expect(mockDeleteFn).toHaveBeenCalledWith("test-uuid-0");
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).not.toHaveBeenCalled();

    // Redo: restore with the same id, never re-create
    mockSelectAnnotation.mockClear();
    mockSetMode.mockClear();
    await action.do();
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
    const restored = mockRestoreFn.mock.calls[0][0];
    expect(restored.id).toBe("test-uuid-0");

    // do() finishes: the restored record is selected and the mode is reset
    expect(mockSelectAnnotation).toHaveBeenCalledWith(expect.objectContaining({ id: "test-uuid-0" }));
    expect(mockSetMode).toHaveBeenCalledWith("editor");
  });
});
