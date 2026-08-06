// ---------------------------------------------------------------------------
// mask_polygon.add_point.test.ts — Mask polygon add-point command tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted to avoid hoisting issues) ─────────────────────────

const { mockSessionSetMode } = vi.hoisted(() => ({
  mockSessionSetMode: vi.fn((mode: "add" | "remove") => {
    _mockSessionMode = mode;
  }),
}));

// State for the maskPolygonDraft mock
let _mockPoints: [number, number][] = [];
let _mockIsEditable = true;
let _mockSessionMode: "add" | "remove" = "add";

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => _mockIsEditable,
}));

vi.mock("$lib/state/mask-tool.svelte", () => ({
  maskTool: {
    active: "polygon",
  },
}));

vi.mock("$lib/state/mask-session.svelte", () => ({
  maskSession: {
    get mode() { return _mockSessionMode; },
    setMode: mockSessionSetMode,
  },
}));

vi.mock("$lib/commands/mode/mask_polygon", () => ({
  maskPolygonDraft: {
    get points() { return _mockPoints; },
    set points(p: [number, number][]) { _mockPoints = p; },
  },
}));

import { command } from "./mask_polygon.add_point";
import { register } from "./mask_polygon.add_point";

describe("annotation.mask_polygon.add_point", () => {
  let mockDriver: any;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockPoints = [];
    _mockIsEditable = true;
    _mockSessionMode = "add";

    mockDriver = {
      command: { register: vi.fn() },
      setMode: vi.fn(),
    };
  });

  it("registers the command on the driver", () => {
    register(mockDriver);
    expect(mockDriver.command.register).toHaveBeenCalledOnce();
    const registered = mockDriver.command.register.mock.calls[0][0];
    expect(registered.name).toBe("annotation.mask_polygon.add_point");
  });

  describe("do() appends the point", () => {
    it("appends a point to an empty draft", () => {
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      action.do();

      expect(_mockPoints).toEqual([[0.5, 0.3]]);
      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
    });

    it("appends a point to an existing draft", () => {
      _mockPoints = [[0.1, 0.2], [0.3, 0.4]];
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      action.do();

      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.3]]);
      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
    });
  });

  describe("undo() restores the prior snapshot exactly", () => {
    it("restores empty state when the draft was empty before add", () => {
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      // Do the add
      action.do();
      expect(_mockPoints).toEqual([[0.5, 0.3]]);

      // Undo
      action.undo();

      // Should restore the exact snapshot before (empty array)
      expect(_mockPoints).toEqual([]);
      expect(mockDriver.setMode).toHaveBeenCalledWith("idah-image:mask");
    });

    it("restores prior points exactly (not just removing last item)", () => {
      _mockPoints = [[0.1, 0.2], [0.3, 0.4]];
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      // Do the add
      action.do();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.3]]);

      // Undo
      action.undo();

      // Should restore the exact snapshot before (not just pop)
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    });

    it("is idempotent — calling undo twice with no intervening do is safe", () => {
      _mockPoints = [[0.1, 0.2]];
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      action.do();
      expect(_mockPoints).toEqual([[0.1, 0.2], [0.5, 0.3]]);

      action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2]]);

      // Second undo — snapshotBefore was captured at creation time,
      // so it restores the same state again (idempotent).
      action.undo();
      expect(_mockPoints).toEqual([[0.1, 0.2]]);
    });
  });

  describe("maskSession.mode is snapshot and restored", () => {
    it("snapshots and restores add mode", () => {
      _mockSessionMode = "add";
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      // Simulate mode change between add-point and undo
      _mockSessionMode = "remove";

      action.do();
      expect(mockSessionSetMode).toHaveBeenCalledWith("add");
      expect(_mockSessionMode).toBe("add");

      // User switches to remove mode
      _mockSessionMode = "remove";

      action.undo();
      // undo should restore the snapshot mode (add)
      expect(mockSessionSetMode).toHaveBeenCalledWith("add");
    });

    it("snapshots and restores remove mode", () => {
      _mockSessionMode = "remove";
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      _mockSessionMode = "add";

      action.do();
      expect(mockSessionSetMode).toHaveBeenCalledWith("remove");
      expect(_mockSessionMode).toBe("remove");

      _mockSessionMode = "add";

      action.undo();
      expect(mockSessionSetMode).toHaveBeenCalledWith("remove");
    });
  });

  describe("isCombinable() returns false", () => {
    it("returns false so rapid point placements don't merge", () => {
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      expect(action.isCombinable()).toBe(false);
    });

    it("combine returns the incoming action unchanged", () => {
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      const incoming = { command: { name: "different" } };
      expect(action.combine(incoming)).toBe(incoming);
    });
  });

  describe("pre-condition checks", () => {
    it("returns noopAction when no props provided", () => {
      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback(); // no opts

      expect(action.isCombinable()).toBe(false);
      // Should not mutate state
      action.do();
      expect(_mockPoints).toEqual([]);
    });

    it("returns noopAction when not editable", () => {
      _mockIsEditable = false;

      register(mockDriver);
      const registered = mockDriver.command.register.mock.calls[0][0];
      const action = registered.callback({ point: [0.5, 0.3] });

      expect(action.isCombinable()).toBe(false);
      action.do();
      // Should not have mutated state
      expect(_mockPoints).toEqual([]);
    });
  });
});