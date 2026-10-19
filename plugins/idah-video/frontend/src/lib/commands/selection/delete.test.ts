// ---------------------------------------------------------------------------
// delete.test.ts — idah-video:selection.delete command tests
//
// Covers the confirmation gate (shortcut / palette / timeline "Delete
// annotation"), the `skipConfirm` re-entry used by the confirmation dialog
// (and by the already-confirmed group context menu), selected-annotation AND
// selected-group resolution, the locked refusals, the re-entrancy guard while
// the dialog is open, and idempotent do/undo cycles.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted so the vi.mock factories can reference them) ───────

const { items, mockDelete, mockRestore, mockDeselect, mockWarningToast, mockConfirmDelete } = vi.hoisted(() => {
  const items: { id: string; shape_type: string; category: string; metadata?: Record<string, unknown> }[] = [];
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
    mockWarningToast: vi.fn(),
    mockConfirmDelete: vi.fn(),
  };
});

// Mutable test state referenced lazily by the mocks below.
let _selectedAnnotationIds = new Set<string>();
let _selectedGroupIds = new Set<string>();
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
    get selectedAnnotationIds() {
      return _selectedAnnotationIds;
    },
    get selectedGroupIds() {
      return _selectedGroupIds;
    },
    hasSelection: () => _selectedAnnotationIds.size > 0 || _selectedGroupIds.size > 0,
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

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: { warning: mockWarningToast },
}));

vi.mock("$lib/components/App/ConfirmDialog/confirm-delete", () => ({
  showConfirmDeleteAnnotationsDialog: mockConfirmDelete,
}));

// Import after mocks
import type { ICommandAction } from "$idah/v2/types";
import { register } from "./delete";

// ─── Helpers ───────────────────────────────────────────────────────────────

interface RegisteredCommandOpts {
  name: string;
  modes: string[];
  shortcut: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  callback: (opts?: Record<string, unknown>) => ICommandAction;
  group?: string;
  activeWhen?: () => boolean;
}

/** Minimal driver whose `command.call` actually runs the registered callback. */
function createDriver(): {
  driver: any;
  registered: RegisteredCommandOpts | undefined;
  lastAction: () => ICommandAction | undefined;
} {
  let registered: RegisteredCommandOpts | undefined;
  const actions: ICommandAction[] = [];

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
  };

  return {
    driver,
    get registered() {
      return registered;
    },
    lastAction: () => actions[actions.length - 1],
  };
}

function mkAnnotation(id: string, metadata?: Record<string, unknown>): {
  id: string;
  shape_type: string;
  category: string;
  metadata?: Record<string, unknown>;
} {
  return { id, shape_type: "idah-video:bounding-box", category: "cat", metadata };
}

describe("selection.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    items.length = 0;
    _selectedAnnotationIds = new Set();
    _selectedGroupIds = new Set();
    _lockedIds = new Set();
    _editable = true;
    _reviewWorkspace = false;
  });

  it("opens the confirmation dialog and does NOT delete when invoked with no opts", () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedAnnotationIds = new Set(["a-1", "a-2"]);

    const ctx = createDriver();
    register(ctx.driver);
    const action = ctx.registered!.callback();

    expect(action.undo).toBeUndefined(); // noop -> not stacked
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
    expect(mockConfirmDelete.mock.calls[0][0].count).toBe(2);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDeselect).not.toHaveBeenCalled();
  });

  it("confirming the dialog deletes the selection via a skipConfirm re-entry and can be undone", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedAnnotationIds = new Set(["a-1", "a-2"]);

    const ctx = createDriver();
    register(ctx.driver);

    ctx.registered!.callback(); // opens the gate
    const dialogOpts = mockConfirmDelete.mock.calls[0][0];

    dialogOpts.onConfirm(); // simulate the user clicking Confirm

    expect(ctx.driver.command.call).toHaveBeenCalledWith(
      "idah-video:selection.delete",
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

  it("resolves all annotations of selected groups and skips the gate when already confirmed", async () => {
    // Two members of group g-1 + one standalone annotation
    items.push(
      mkAnnotation("g1-a", { group_id: "g-1" }),
      mkAnnotation("g1-b", { group_id: "g-1" }),
      mkAnnotation("standalone"),
    );
    _selectedGroupIds = new Set(["g-1"]);

    const ctx = createDriver();
    register(ctx.driver);

    // The timeline group context menu confirms itself, then passes skipConfirm.
    const action = ctx.registered!.callback({ skipConfirm: true });
    expect(mockConfirmDelete).not.toHaveBeenCalled();
    expect(action.undo).toBeDefined();

    await action.do();
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith("g1-a");
    expect(mockDelete).toHaveBeenCalledWith("g1-b");
    expect(mockDelete).not.toHaveBeenCalledWith("standalone");
  });

  it("honors an explicit id snapshot over the live selection", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"), mkAnnotation("a-3"));
    _selectedAnnotationIds = new Set(["a-1", "a-2"]);

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
    _selectedAnnotationIds = new Set(["a-1"]);
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
    _selectedAnnotationIds = new Set(["a-1"]);

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

    _selectedAnnotationIds = new Set(["a-1"]);
    expect(ctx.registered!.callback().undo).toBeUndefined(); // gate -> noop action
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("do and undo are idempotent across repeated runs", async () => {
    items.push(mkAnnotation("a-1"), mkAnnotation("a-2"));
    _selectedAnnotationIds = new Set(["a-1", "a-2"]);

    const ctx = createDriver();
    register(ctx.driver);

    const action = ctx.registered!.callback({ skipConfirm: true });
    await action.do();

    const deleteCount = mockDelete.mock.calls.length;
    expect(deleteCount).toBe(2);

    await action.do(); // redo replay -> nothing extra
    expect(mockDelete.mock.calls.length).toBe(deleteCount);

    await action.undo?.();
    const restoreCount = mockRestore.mock.calls.length;
    expect(restoreCount).toBe(2);

    await action.undo?.(); // second undo -> no duplicates
    expect(mockRestore.mock.calls.length).toBe(restoreCount);
  });
});
