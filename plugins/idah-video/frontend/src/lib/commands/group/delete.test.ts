// ---------------------------------------------------------------------------
// delete.test.ts — Integration tests for annotation.group.delete
//
// Drives the real delete.ts against mocked data/selection/editor/annotation
// stores. Verifies that undo restores (never re-creates) the deleted
// annotations, since deletes are soft and create() is a plain insert.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { register as registerGroupDelete } from "./delete";

// ── Hoisted mutable state for mocks ────────────────────────────────────────
const mockDataItems = vi.hoisted(() => [] as any[]);
const mockDeleteFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockRestoreFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockCreateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockDeselect = vi.hoisted(() => vi.fn());
const mockIsEditable = vi.hoisted(() => vi.fn(() => true));
const mockIsLocked = vi.hoisted(() => vi.fn(() => false));
const mockToastWarning = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      get items() {
        return mockDataItems;
      },
      delete: mockDeleteFn,
      restore: mockRestoreFn,
      create: mockCreateFn,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    deselect: mockDeselect,
    hasGroupSelection: () => true,
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => mockIsEditable(),
}));

vi.mock("$lib/state/annotation.svelte", () => ({
  annotation: { isLocked: mockIsLocked },
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: { warning: mockToastWarning },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAnn(id: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    shape_type: "idah-video:bounding-box",
    shape_args: {
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
    ...overrides,
  };
}

function registerCommands(): { deleteCallback: (...args: any[]) => any } {
  const result: any = {};
  mockRegister.mockImplementation((opts: any) => {
    if (opts.name === "idah-video:annotation.group.delete") {
      result.deleteCallback = opts.callback;
    }
  });
  const mockDriver = {
    command: { register: mockRegister },
    workflowStep: "annotate",
  };
  registerGroupDelete(mockDriver as any);
  return result;
}

function resetMocks(): void {
  mockDataItems.splice(0, mockDataItems.length);
  mockDeleteFn.mockReset();
  mockDeleteFn.mockResolvedValue(undefined);
  mockRestoreFn.mockReset();
  mockRestoreFn.mockResolvedValue({ id: "restored" });
  mockCreateFn.mockReset();
  mockCreateFn.mockResolvedValue({ id: "created" });
  mockDeselect.mockReset();
  mockIsEditable.mockReset();
  mockIsEditable.mockReturnValue(true);
  mockIsLocked.mockReset();
  mockIsLocked.mockReturnValue(false);
  mockToastWarning.mockReset();
  mockRegister.mockReset();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("annotation.group.delete", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("do → undo calls restore once per annotation and never calls create", async () => {
    const a = makeAnn("a");
    const b = makeAnn("b");
    mockDataItems.push(a, b);

    const { deleteCallback } = registerCommands();
    const action = deleteCallback({ annotations: [a, b] });

    await action.do();
    expect(mockDeleteFn).toHaveBeenCalledTimes(2);
    expect(mockDeleteFn).toHaveBeenCalledWith("a");
    expect(mockDeleteFn).toHaveBeenCalledWith("b");

    mockDeleteFn.mockClear();
    await action.undo!();

    expect(mockRestoreFn).toHaveBeenCalledTimes(2);
    expect(mockRestoreFn).toHaveBeenCalledWith(a);
    expect(mockRestoreFn).toHaveBeenCalledWith(b);
    expect(mockCreateFn).not.toHaveBeenCalled();
  });

  it("resolves members by groupId from the data store", async () => {
    const a = makeAnn("a", { metadata: { group_id: "g1" } });
    const b = makeAnn("b", { metadata: { group_id: "g1" } });
    mockDataItems.push(a, b);

    const { deleteCallback } = registerCommands();
    const action = deleteCallback({ groupId: "g1" });

    await action.do();
    expect(mockDeleteFn).toHaveBeenCalledTimes(2);
  });
});
