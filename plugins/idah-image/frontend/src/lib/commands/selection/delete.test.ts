// ---------------------------------------------------------------------------
// delete.test.ts — idah-image:selection.delete command tests
//
// Covers the confirmation gate (shortcut / palette invocation with no opts),
// the `skipConfirm` re-entry used by the confirmation dialog, the locked
// annotation refusal, the re-entrancy guard while the dialog is open, and the
// idempotent do/undo cycles.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted so the vi.mock factories can reference them) ───────

const { items, mockDelete, mockRestore, mockDeselect, mockInvalidateAll, mockWarningToast, mockConfirmDelete } =
  vi.hoisted(() => {
    const items: { id: string; shape_type: string; category: string }[] = [];
    return {
      items,
      mockDelete: vi.fn(async (id: string) => {
        const i = items.findIndex((x) => x.id === id);
        if (i >= 0) items.splice(i, 1);
      }),
      mockRestore: vi.fn(async (rec: { id: string }) => {
        if (!items.some((x) => x.id === rec.id)) items.push(rec as never);
      }),
      mockDeselect: vi.fn(),
      mockInvalidateAll: vi.fn(),
      mockWarningToast: vi.fn(),
      mockConfirmDelete: vi.fn(),
    };
  });

// Mutable test state referenced lazily by the mocks below.
let _selectedIds: string[] = [];
let _lockedIds = new Set<string>();
let _editable = true;
let _reviewWorkspace = false;

vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      get items() {
        return items;
      },
      delete: mockDelete,
      restore: mockRestore,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get selectedAnnotations() {
      return items.filter((a) => _selectedIds.includes(a.id));
    },
    hasSelection: () => _selectedIds.length > 0,
    deselect: mockDeselect,
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => _editable,
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {
    get isReviewWorkspace() {
      return _reviewWorkspace;
    },
  },
}));

vi.mock("$lib/state/annotation.svelte", () => ({
  annotation: {
    isLocked: (a: { id: string }) => _lockedIds.has(a.id),
    isHidden: () => false,
  },
}));

vi.mock("$lib/mask/tile-cache", () => ({
  invalidateAll: mockInvalidateAll,
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: { warning: mockWarningToast },
}));

vi.mock("$lib/components/App/ConfirmDialog/confirm-delete", () => ({
  confirmAnnotationsDelete: mockConfirmDelete,
}));

// Import after mocks
import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import { register } from "./delete";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Concrete shape of the action returned by the delete command's undoable path.
 * The shared `ICommandAction` types `do` as sync `void` and `undo` as optional,
 * but `delete.ts` implements both as async functions whose promises the tests
 * must await. This stays assignable to `ICommandAction` while exposing the real
 * async (and always undoable, when present) runtime shape.
 */
interface UndoableAction extends ICommandAction {
  do(): Promise<void>;
  undo(): Promise<void>;
}

interface RegisteredCommandOpts {
  name: string;
  modes: string[];
  shortcut: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  callback: (opts?: Record<string, unknown>) => UndoableAction;
  group?: string;
  activeWhen?: () => boolean;
}

/** Minimal driver whose `command.call` actually runs the registered callback. */
function createDriver(): {
  driver: any;
  registered: RegisteredCommandOpts | undefined;
  lastAction: () => UndoableAction | undefined;
} {
  let registered: RegisteredCommandOpts | undefined;
  const actions: UndoableAction[] = [];
  // type DriverMock = Pick<IIdahDriverV2, "command">;

  const driver = {
    command: {
      register: vi.fn((opts: RegisteredCommandOpts) => {
        registered = opts;
      }),
      call: vi.fn((name: string, ...args: Record<string, unknown>[]) => {
        if (registered && registered.name === name) {
          const action = registered.callback(args[0] ?? {});
          actions.push(action);
          return action;
        }
        return undefined;
      }),
    },
  }  as unknown as IIdahDriverV2;

  return {
    driver: driver as never,
    get registered() {
      return registered;
    },
    lastAction: () => actions[actions.length - 1],
  };
}

function mkAnnotation(id: string): { id: string; shape_type: string; category: string } {
  return { id, shape_type: "idah-image:polygon", category: "cat" };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("selection.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    items.length = 0;
    _selectedIds = [];
    _lockedIds = new Set();
    _editable = true;
    _reviewWorkspace = false;
  });

  it("opens the confirmation dialog and does NOT delete when invoked with no opts", () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedIds = ["a-1", "a-2"];

    const ctx = createDriver();
    register(ctx.driver);
    const action = ctx.registered!.callback();

    // Gate -> noop (no undo -> not stacked), dialog shown, nothing deleted.
    expect(action.undo).toBeUndefined();
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
    expect(mockConfirmDelete.mock.calls[0][0].count).toBe(2);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDeselect).not.toHaveBeenCalled();
  });

  it("confirming the dialog deletes the selection through a skipConfirm re-entry and can be undone", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedIds = ["a-1", "a-2"];

    const ctx = createDriver();
    register(ctx.driver);

    ctx.registered!.callback(); // opens the gate
    const dialogOpts = mockConfirmDelete.mock.calls[0][0];

    dialogOpts.onConfirm(); // simulate the user clicking Confirm

    expect(ctx.driver.command.call).toHaveBeenCalledWith(
      "idah-image:selection.delete",
      expect.objectContaining({ skipConfirm: true, ids: ["a-1", "a-2"] }),
    );

    const action = ctx.lastAction();
    expect(action).toBeDefined();
    expect(action!.undo).toBeDefined(); // undoable -> will be stacked

    await action!.do();
    expect(mockDeselect).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(items.find((i) => i.id === "a-1")).toBeUndefined();

    await action!.undo?.();
    expect(mockRestore).toHaveBeenCalledTimes(2);
    expect(items.find((i) => i.id === "a-1")).toBeDefined();
  });

  it("reopens the confirmation dialog after a cancel (guard released via onCancel)", () => {
    items.push(mkAnnotation("a-1"));
    _selectedIds = ["a-1"];

    const ctx = createDriver();
    register(ctx.driver);

    ctx.registered!.callback(); // opens the dialog
    const dialogOpts = mockConfirmDelete.mock.calls[0][0];

    dialogOpts.onCancel(); // simulate the user clicking Cancel

    // Nothing was deleted and the re-entrancy guard was released.
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDeselect).not.toHaveBeenCalled();

    // The next shortcut invocation opens the dialog again instead of no-oping.
    ctx.registered!.callback();
    expect(mockConfirmDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("skips the gate and deletes directly when called with skipConfirm: true", async () => {
    items.push(mkAnnotation("a-1"));
    _selectedIds = ["a-1"];

    const ctx = createDriver();
    register(ctx.driver);

    const action = ctx.registered!.callback({ skipConfirm: true });
    expect(mockConfirmDelete).not.toHaveBeenCalled();
    expect(action.undo).toBeDefined();

    await action.do();
    expect(mockDelete).toHaveBeenCalledWith("a-1");
  });

  it("honors an explicit id snapshot over the live selection", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"), mkAnnotation("a-3"));
    _selectedIds = ["a-1", "a-2"];

    const ctx = createDriver();
    register(ctx.driver);

    const action = ctx.registered!.callback({ skipConfirm: true, ids: ["a-1", "a-3"] });
    await action.do();

    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith("a-1");
    expect(mockDelete).toHaveBeenCalledWith("a-3");
    expect(mockDelete).not.toHaveBeenCalledWith("a-2");
  });

  it("refuses locked annotations in both the gate and the skipConfirm path", () => {
    items.push(mkAnnotation("a-1"));
    _selectedIds = ["a-1"];
    _lockedIds.add("a-1");

    const ctx = createDriver();
    register(ctx.driver);

    const gate = ctx.registered!.callback();
    expect(gate.undo).toBeUndefined();
    expect(mockConfirmDelete).not.toHaveBeenCalled();
    expect(mockWarningToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot delete annotation" }),
    );
    expect(mockDelete).not.toHaveBeenCalled();

    const direct = ctx.registered!.callback({ skipConfirm: true });
    expect(direct.undo).toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("ignores re-entrant gate invocations while the dialog is open", () => {
    items.push(mkAnnotation("a-1"));
    _selectedIds = ["a-1"];

    const ctx = createDriver();
    register(ctx.driver);

    ctx.registered!.callback(); // opens the dialog
    ctx.registered!.callback(); // second invocation while dialog open -> noop

    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when not editable, in review workspace, or with an empty selection", () => {
    const ctx = createDriver();
    register(ctx.driver);

    _editable = false;
    expect(ctx.registered!.callback().undo).toBeUndefined();

    _editable = true;
    _reviewWorkspace = true;
    expect(ctx.registered!.callback().undo).toBeUndefined();

    _reviewWorkspace = false;
    items.push(mkAnnotation("a-1"));
    expect(ctx.registered!.callback().undo).toBeUndefined(); // nothing selected

    _selectedIds = ["a-1"];
    expect(ctx.registered!.callback().undo).toBeUndefined(); // gate -> noop action
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("do and undo are idempotent across repeated runs", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedIds = ["a-1", "a-2"];

    const ctx = createDriver();
    register(ctx.driver);

    const action = ctx.registered!.callback({ skipConfirm: true });
    await action.do();

    const deleteCount = mockDelete.mock.calls.length;
    expect(deleteCount).toBe(2);

    // Re-running do() (as a redo replay would) deletes nothing extra.
    await action.do();
    expect(mockDelete.mock.calls.length).toBe(deleteCount);

    await action.undo?.();
    const restoreCount = mockRestore.mock.calls.length;
    expect(restoreCount).toBe(2);

    // Re-running undo() restores nothing extra (no duplicates).
    await action.undo?.();
    expect(mockRestore.mock.calls.length).toBe(restoreCount);
  });

  it("deselects before deleting and cleans mask tile caches for mask annotations", async () => {
    items.push(
      mkAnnotation("poly-1"),
      { id: "mask-1", shape_type: "idah-image:mask", category: "mask-cat" },
    );
    _selectedIds = ["poly-1", "mask-1"];

    const ctx = createDriver();
    register(ctx.driver);

    const action = ctx.registered!.callback({ skipConfirm: true });
    await action.do();

    expect(mockDeselect).toHaveBeenCalledTimes(1);
    expect(mockInvalidateAll).toHaveBeenCalledWith("mask-1");
    expect(mockInvalidateAll).not.toHaveBeenCalledWith("poly-1");
  });
});