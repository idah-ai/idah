// ---------------------------------------------------------------------------
// ui.test.ts — Unit tests for UI state
//
// Tests the UIState store which includes:
//   - Dialog toggles (command dialog, debug console)
//   - localStorage-backed preferences (frameStep, colorMode, renderMode, timeDisplay)
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ui } from "./ui.svelte";

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------
const localStorageMock = vi.hoisted(() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _reset: () => {
      store = {};
    },
  };
});

vi.stubGlobal("localStorage", localStorageMock);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UIState", () => {
  beforeEach(() => {
    localStorageMock._reset();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    // Reset dialogs
    ui.isCommandDialogOpen = false;
    ui.isDebugConsoleOpen = false;
  });

  // ── Dialog toggles ──────────────────────────────────────────────────

  describe("dialog toggles", () => {
    it("starts with both dialogs closed", () => {
      expect(ui.isCommandDialogOpen).toBe(false);
      expect(ui.isDebugConsoleOpen).toBe(false);
    });

    it("toggleCommandDialog opens the command dialog", () => {
      ui.toggleCommandDialog();
      expect(ui.isCommandDialogOpen).toBe(true);
    });

    it("toggleCommandDialog closes an open command dialog", () => {
      ui.isCommandDialogOpen = true;
      ui.toggleCommandDialog();
      expect(ui.isCommandDialogOpen).toBe(false);
    });

    it("toggleDebugConsole opens the debug console", () => {
      ui.toggleDebugConsole();
      expect(ui.isDebugConsoleOpen).toBe(true);
    });

    it("toggleDebugConsole closes an open debug console", () => {
      ui.isDebugConsoleOpen = true;
      ui.toggleDebugConsole();
      expect(ui.isDebugConsoleOpen).toBe(false);
    });
  });

  // ── frameStep ───────────────────────────────────────────────────────

  describe("frameStep", () => {
    it("defaults to 10", () => {
      expect(ui.frameStep).toBe(10);
    });

    it("persists to localStorage on set", () => {
      ui.frameStep = 5;
      expect(localStorageMock.setItem).toHaveBeenCalledWith("idah-image:settings:frame-step", "5");
    });

    it("returns the set value", () => {
      ui.frameStep = 25;
      expect(ui.frameStep).toBe(25);
    });
  });

  // ── colorMode ───────────────────────────────────────────────────────

  describe("colorMode", () => {
    it("defaults to 'category'", () => {
      expect(ui.colorMode).toBe("category");
    });

    it("persists to localStorage on set", () => {
      ui.colorMode = "random";
      expect(localStorageMock.setItem).toHaveBeenCalledWith("idah-image:settings:color-mode", '"random"');
    });

    it("returns the set value", () => {
      ui.colorMode = "random";
      expect(ui.colorMode).toBe("random");
    });

    it("accepts valid ColorMode values", () => {
      ui.colorMode = "category";
      expect(ui.colorMode).toBe("category");
      ui.colorMode = "random";
      expect(ui.colorMode).toBe("random");
    });
  });

  // ── renderMode ──────────────────────────────────────────────────────

  describe("renderMode", () => {
    it("defaults to 'bilinear'", () => {
      expect(ui.renderMode).toBe("bilinear");
    });

    it("persists to localStorage on set", () => {
      ui.renderMode = "nearest-neighbor";
      expect(localStorageMock.setItem).toHaveBeenCalledWith("idah-image:settings:render-mode", '"nearest-neighbor"');
    });

    it("returns the set value", () => {
      ui.renderMode = "nearest-neighbor";
      expect(ui.renderMode).toBe("nearest-neighbor");
    });
  });

  // ── timeDisplay ─────────────────────────────────────────────────────

  describe("timeDisplay", () => {
    it("defaults to 'frames'", () => {
      expect(ui.timeDisplay).toBe("frames");
    });

    it("persists to localStorage on set", () => {
      ui.timeDisplay = "time";
      expect(localStorageMock.setItem).toHaveBeenCalledWith("idah-image:settings:time-display", '"time"');
    });

    it("returns the set value", () => {
      ui.timeDisplay = "time";
      expect(ui.timeDisplay).toBe("time");
    });
  });

  // ── Independent state ───────────────────────────────────────────────

  it("maintains independent state for each preference", () => {
    ui.frameStep = 3;
    ui.colorMode = "random";
    ui.renderMode = "nearest-neighbor";
    ui.timeDisplay = "time";

    expect(ui.frameStep).toBe(3);
    expect(ui.colorMode).toBe("random");
    expect(ui.renderMode).toBe("nearest-neighbor");
    expect(ui.timeDisplay).toBe("time");
  });
});
