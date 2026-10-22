// ---------------------------------------------------------------------------
// merge.test.ts — Integration tests for annotation.merge
//
// Drives the real merge.ts (and split.ts for the round-trip) against mocked
// data/selection/viewport/editor/toast stores.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { register as registerMerge } from "./merge";
import { register as registerSplit } from "./split";

// ── Hoisted mutable state for mocks ────────────────────────────────────────
const mockDataItems = vi.hoisted(() => [] as any[]);
const mockUpdateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockDeleteFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockRestoreFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockCreateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockSelectedAnnotationIds = vi.hoisted(() => new Set<string>());
const mockSelectedGroupIds = vi.hoisted(() => new Set<string>());
const mockSelectionValue = vi.hoisted(() => ({ value: null as any }));
const mockSelectAnnotation = vi.hoisted(() => vi.fn());
const mockSelectAnnotations = vi.hoisted(() => vi.fn());
const mockIsEditable = vi.hoisted(() => vi.fn(() => true));
const mockIsReviewWorkspace = vi.hoisted(() => ({ value: false }));
const mockCurrentFrameValue = vi.hoisted(() => ({ value: 0 }));
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastWarning = vi.hoisted(() => vi.fn());
const mockIsLocked = vi.hoisted(() => vi.fn(() => false));
const mockUuidv7 = vi.hoisted(() => {
  let counter = 0;
  return vi.fn(() => `test-uuid-${counter++}`);
});
const mockRegister = vi.hoisted(() => vi.fn());

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      get items() {
        return mockDataItems;
      },
      update: mockUpdateFn,
      delete: mockDeleteFn,
      restore: mockRestoreFn,
      create: mockCreateFn,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get selectedAnnotationIds() {
      return mockSelectedAnnotationIds;
    },
    get selectedGroupIds() {
      return mockSelectedGroupIds;
    },
    get value() {
      return mockSelectionValue.value;
    },
    hasSelection: () => mockSelectedAnnotationIds.size > 0 || mockSelectedGroupIds.size > 0,
    selectAnnotation: mockSelectAnnotation,
    selectAnnotations: mockSelectAnnotations,
  },
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {
    get isReviewWorkspace() {
      return mockIsReviewWorkspace.value;
    },
    video: { currentFrame: mockCurrentFrameValue },
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => mockIsEditable(),
}));

vi.mock("$lib/state/annotation.svelte", () => ({
  annotation: { isLocked: mockIsLocked },
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: {
    success: mockToastSuccess,
    warning: mockToastWarning,
  },
}));

vi.mock("uuidv7", () => ({
  uuidv7: mockUuidv7,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makePiece(id: string, start: number, end: number, overrides: Record<string, unknown> = {}): any {
  const frames = [];
  for (let f = start; f <= end; f++) {
    frames.push({
      frame: f,
      angle: 0,
      points: [
        [0, 0],
        [10, 10],
      ],
    });
  }
  return {
    id,
    shape_type: "idah-video:bounding-box",
    shape_args: { start, end, frames },
    category: "test/cat",
    ...overrides,
  };
}

/** Root piece — carries its group key as its own id (no group_id). */
function makeRoot(id: string, start: number, end: number, overrides: Record<string, unknown> = {}): any {
  return makePiece(id, start, end, overrides);
}

/** Child piece — carries the group key via metadata.group_id. */
function makeChild(
  id: string,
  groupId: string,
  start: number,
  end: number,
  overrides: Record<string, unknown> = {},
): any {
  return makePiece(id, start, end, { metadata: { group_id: groupId }, ...overrides });
}

function registerCommands(): {
  mergeCallback: (...args: any[]) => any;
  mergeActiveWhen: () => boolean;
  splitCallback: (...args: any[]) => any;
} {
  const result: any = {};
  mockRegister.mockImplementation((opts: any) => {
    if (opts.name === "idah-video:annotation.merge") {
      result.mergeCallback = opts.callback;
      result.mergeActiveWhen = opts.activeWhen;
    } else if (opts.name === "idah-video:annotation.split") {
      result.splitCallback = opts.callback;
    }
  });
  const mockDriver = {
    command: { register: mockRegister },
    workflowStep: "annotate",
  };
  registerMerge(mockDriver as any);
  registerSplit(mockDriver as any, () => mockCurrentFrameValue.value);
  return result;
}

function resetMocks(): void {
  mockDataItems.splice(0, mockDataItems.length);
  mockUpdateFn.mockReset();
  mockUpdateFn.mockResolvedValue(undefined);
  mockDeleteFn.mockReset();
  mockDeleteFn.mockResolvedValue(undefined);
  mockRestoreFn.mockReset();
  mockRestoreFn.mockResolvedValue({ id: "restored" });
  mockCreateFn.mockReset();
  mockCreateFn.mockResolvedValue({ id: "created" });
  mockSelectedAnnotationIds.clear();
  mockSelectedGroupIds.clear();
  mockSelectionValue.value = null;
  mockSelectAnnotation.mockReset();
  mockSelectAnnotations.mockReset();
  mockIsEditable.mockReset();
  mockIsEditable.mockReturnValue(true);
  mockIsReviewWorkspace.value = false;
  mockCurrentFrameValue.value = 0;
  mockToastSuccess.mockReset();
  mockToastWarning.mockReset();
  mockIsLocked.mockReset();
  mockIsLocked.mockReturnValue(false);
  mockUuidv7.mockReset();
  mockRegister.mockReset();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("annotation.merge", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("do() updates merged then deletes each absorbed piece, selects merged, shows success toast", async () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeCallback } = registerCommands();
    const action = mergeCallback();

    await action.do();

    expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    const merged = mockUpdateFn.mock.calls[0][0];
    expect(merged.id).toBe("a");
    expect(merged.shape_args.start).toBe(0);
    expect(merged.shape_args.end).toBe(9);

    // delete called once per absorbed piece, after update
    expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    expect(mockDeleteFn).toHaveBeenCalledWith("b");

    expect(mockSelectAnnotation).toHaveBeenCalledWith(merged);
    expect(mockToastSuccess).toHaveBeenCalledWith({
      title: "Annotations merged",
      description: "Merged frames 1–10",
    });
  });

  it("undo() updates survivor, restores each absorbed piece, re-selects all", async () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeCallback } = registerCommands();
    const action = mergeCallback();

    await action.undo!();

    expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    expect(mockUpdateFn).toHaveBeenCalledWith(a);
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
    expect(mockRestoreFn).toHaveBeenCalledWith(b);
    expect(mockSelectAnnotations).toHaveBeenCalledWith(["a", "b"]);
  });

  it("returns a noop with no toast when read-only", () => {
    mockIsEditable.mockReturnValue(false);
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeCallback } = registerCommands();
    const action = mergeCallback();

    expect(action.undo).toBeUndefined();
    expect(mockToastWarning).not.toHaveBeenCalled();
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("returns a noop with no toast in the review workspace", () => {
    mockIsReviewWorkspace.value = true;
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 5, 9);
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeCallback } = registerCommands();
    const action = mergeCallback();

    expect(action.undo).toBeUndefined();
    expect(mockToastWarning).not.toHaveBeenCalled();
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("shows a warning toast and leaves store mocks uncalled on a failing plan", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 6, 9); // one-frame gap
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeCallback } = registerCommands();
    const action = mergeCallback();

    expect(action.undo).toBeUndefined();
    expect(mockToastWarning).toHaveBeenCalledWith({
      title: "Cannot merge annotations",
      description: "Selected annotations are not continuous (gap at frame 6).",
    });
    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });

  it("activeWhen is true for an editable, non-empty but invalid selection", () => {
    const a = makeRoot("a", 0, 4);
    const b = makeChild("b", "a", 6, 9); // invalid (gap) but selection exists
    mockDataItems.push(a, b);
    mockSelectedAnnotationIds.add("a");
    mockSelectedAnnotationIds.add("b");

    const { mergeActiveWhen } = registerCommands();
    expect(mergeActiveWhen()).toBe(true);
  });

  it("activeWhen is false with no selection", () => {
    const { mergeActiveWhen } = registerCommands();
    expect(mergeActiveWhen()).toBe(false);
  });

  it("activeWhen is false when read-only", () => {
    mockIsEditable.mockReturnValue(false);
    mockSelectedAnnotationIds.add("a");
    const { mergeActiveWhen } = registerCommands();
    expect(mergeActiveWhen()).toBe(false);
  });

  it("activeWhen is false in the review workspace", () => {
    mockIsReviewWorkspace.value = true;
    mockSelectedAnnotationIds.add("a");
    const { mergeActiveWhen } = registerCommands();
    expect(mergeActiveWhen()).toBe(false);
  });

  it("split redo: do → undo → do creates once then restores the right piece", async () => {
    const original = makePiece("orig", 0, 4, {
      shape_args: {
        start: 0,
        end: 4,
        frames: [
          { frame: 0, angle: 0, points: [[0, 0], [100, 100]] },
          { frame: 4, angle: 0, points: [[20, 20], [80, 80]] },
        ],
      },
    });
    mockDataItems.push(original);
    mockSelectedAnnotationIds.add("orig");

    const { splitCallback } = registerCommands();
    const action = splitCallback({ annotationId: "orig", at: 3 });

    // First run: create the right piece
    await action.do();
    expect(mockCreateFn).toHaveBeenCalledTimes(1);
    const right = mockCreateFn.mock.calls[0][0];
    expect(right.id).toBe("test-uuid-0");

    // Undo: soft-deletes the right piece
    mockCreateFn.mockClear();
    mockRestoreFn.mockClear();
    await action.undo!();
    expect(mockDeleteFn).toHaveBeenCalledWith(right.id);
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).not.toHaveBeenCalled();

    // Redo: restore the right piece instead of creating it again
    await action.do();
    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
    expect(mockRestoreFn).toHaveBeenCalledWith(right);
  });

  it("split → merge → undo merge → undo split → redo split → redo merge succeeds", async () => {
    const original = makePiece("orig", 0, 4, {
      shape_args: {
        start: 0,
        end: 4,
        frames: [
          { frame: 0, angle: 0, points: [[0, 0], [100, 100]] },
          { frame: 4, angle: 0, points: [[20, 20], [80, 80]] },
        ],
      },
    });
    mockDataItems.push(original);
    mockSelectedAnnotationIds.add("orig");

    const { splitCallback, mergeCallback } = registerCommands();

    // Split
    const splitAction = splitCallback({ annotationId: "orig", at: 3 });
    await splitAction.do();
    const left = mockUpdateFn.mock.calls[0][0];
    const right = mockCreateFn.mock.calls[0][0];

    // Merge the two pieces
    mockDataItems.splice(0, mockDataItems.length, left, right);
    mockSelectedAnnotationIds.clear();
    mockSelectedAnnotationIds.add(left.id);
    mockSelectedAnnotationIds.add(right.id);
    const mergeAction = mergeCallback();
    await mergeAction.do();

    // Undo merge
    await mergeAction.undo!();
    // Undo split
    await splitAction.undo!();
    // Redo split (must restore, not create)
    await splitAction.do();
    // Redo merge
    await mergeAction.do();

    // Every store call succeeded (mocks resolve by default); final state is merged
    const merged = mockUpdateFn.mock.calls[mockUpdateFn.mock.calls.length - 1][0];
    expect(merged.id).toBe("orig");
    expect(merged.shape_args.start).toBe(0);
    expect(merged.shape_args.end).toBe(4);
    expect(merged.shape_args.frames.map((f: any) => f.frame)).toEqual([0, 2, 3, 4]);
    // The right piece was restored on redo, not re-created
    expect(mockRestoreFn).toHaveBeenCalledWith(right);
  });

  it("split → merge round-trip restores original id, range and keyframes plus seams", async () => {
    // Original single annotation
    const original = makePiece("orig", 0, 4, {
      shape_args: {
        start: 0,
        end: 4,
        frames: [
          {
            frame: 0,
            angle: 0,
            points: [
              [0, 0],
              [100, 100],
            ],
          },
          {
            frame: 4,
            angle: 0,
            points: [
              [20, 20],
              [80, 80],
            ],
          },
        ],
      },
    });
    mockDataItems.push(original);
    mockSelectedAnnotationIds.add("orig");

    const { splitCallback, mergeCallback } = registerCommands();

    // Split at frame 3 (1-based) → splitAt = 2
    const splitAction = splitCallback({ annotationId: "orig", at: 3 });
    await splitAction.do();

    // After split: original updated to left piece [0,2], right piece [3,4] created
    const left = mockUpdateFn.mock.calls[0][0];
    const right = mockCreateFn.mock.calls[0][0];
    expect(left.id).toBe("orig");
    expect(left.shape_args.start).toBe(0);
    expect(left.shape_args.end).toBe(2);
    expect(right.shape_args.start).toBe(3);
    expect(right.shape_args.end).toBe(4);
    expect(right.metadata.group_id).toBe("orig");

    // Now merge the two pieces back
    mockDataItems.splice(0, mockDataItems.length, left, right);
    mockSelectedAnnotationIds.clear();
    mockSelectedAnnotationIds.add(left.id);
    mockSelectedAnnotationIds.add(right.id);
    mockUpdateFn.mockClear();
    mockDeleteFn.mockClear();

    const mergeAction = mergeCallback();
    await mergeAction.do();

    expect(mockUpdateFn).toHaveBeenCalledTimes(1);
    const merged = mockUpdateFn.mock.calls[0][0];
    expect(merged.id).toBe("orig");
    expect(merged.shape_args.start).toBe(0);
    expect(merged.shape_args.end).toBe(4);
    // Original keyframes [0,4] plus the two seam keyframes [2,3]
    expect(merged.shape_args.frames.map((f: any) => f.frame)).toEqual([0, 2, 3, 4]);
    // The right piece was absorbed (deleted)
    expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    expect(mockDeleteFn).toHaveBeenCalledWith(right.id);
  });
});
