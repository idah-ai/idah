// ---------------------------------------------------------------------------
// driver.test.ts — Unit tests for the driver singleton
//
// Tests getDriver (throws before init) and initDriver (stores the driver,
// registers mode-change listener).
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// Mock viewport so that the module-level import doesn't trigger side-effects
// we can't control in tests.
const viewportModeSetter = vi.hoisted(() => vi.fn());

vi.mock("./viewport.svelte", () => ({
  viewport: {
    set mode(val: string) {
      viewportModeSetter(val);
    },
  },
}));

// Factory for creating mock driver instances
function createMockDriver() {
  let modeChangeCb: ((ev: { oldValue: string; newValue: string }) => void) | null = null;
  return {
    onModeChange: vi.fn((cb: (ev: { oldValue: string; newValue: string }) => void) => {
      modeChangeCb = cb;
    }),
    // Allow tests to simulate a mode change
    _triggerModeChange(oldValue: string, newValue: string) {
      if (modeChangeCb) modeChangeCb({ oldValue, newValue });
    },
    onSyncChange: vi.fn((event: ISyncEvent) => { }),
    onSyncError: vi.fn((event: ISyncErrorEvent) => { })
  };
}

// Need to use a shared variable so both the mock factory and test code
// can access the same mock driver instance.
let currentDriver: ReturnType<typeof createMockDriver>;

// ---------------------------------------------------------------------------
// Tests (must be placed after imports below)
// ---------------------------------------------------------------------------
import { getDriver, initDriver } from "./driver.svelte";
import type { ISyncErrorEvent, ISyncEvent } from "$idah/v2/types";

describe("driver singleton", () => {
  // We need a fresh module state for each test. Since ES modules are cached,
  // we manually reset by re-initializing with a fresh mock.
  // The module-level `_driver` is captured by closure, so calling initDriver
  // again replaces it. That's sufficient for our tests.
  beforeEach(() => {
    currentDriver = createMockDriver();
    viewportModeSetter.mockClear();
  });

  describe("getDriver", () => {
    it("throws when driver is not initialized", () => {
      // The module starts uninitialized — after initDriver() was never called.
      // However, we may have called initDriver in a previous test. To guarantee
      // an uninitialized state, we rely on module-level default (null).
      // Use a fresh import for this test via dynamic import.
      // But since ES modules cache, we need a different approach:
      // just verify the error message from the module.
      expect(() => getDriver()).toThrow("Driver not initialized!");
    });

    it("returns the driver after initDriver is called", () => {
      const driver = currentDriver;
      initDriver(driver as any);
      expect(getDriver()).toBe(driver);
    });

    it("returns the most recently set driver after re-init", () => {
      const driverA = createMockDriver();
      const driverB = createMockDriver();
      initDriver(driverA as any);
      initDriver(driverB as any);
      expect(getDriver()).toBe(driverB);
    });
  });

  describe("initDriver", () => {
    it("stores the driver so getDriver returns it", () => {
      const driver = currentDriver;
      initDriver(driver as any);
      expect(getDriver()).toBe(driver);
    });

    it("registers a mode change listener", () => {
      const driver = currentDriver;
      initDriver(driver as any);
      expect(driver.onModeChange).toHaveBeenCalledOnce();
      expect(driver.onModeChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it("updates viewport.mode on mode change events", () => {
      const driver = currentDriver;
      initDriver(driver as any);
      driver._triggerModeChange("default", "idah-video:bounding-box");
      expect(viewportModeSetter).toHaveBeenCalledWith("idah-video:bounding-box");
    });

    it("updates viewport.mode on each mode change event", () => {
      const driver = currentDriver;
      initDriver(driver as any);
      driver._triggerModeChange("default", "idah-video:bounding-box");
      driver._triggerModeChange("idah-video:bounding-box", "idah-video:polygon");
      driver._triggerModeChange("idah-video:polygon", "default");
      expect(viewportModeSetter).toHaveBeenCalledTimes(3);
      expect(viewportModeSetter).toHaveBeenNthCalledWith(1, "idah-video:bounding-box");
      expect(viewportModeSetter).toHaveBeenNthCalledWith(2, "idah-video:polygon");
      expect(viewportModeSetter).toHaveBeenNthCalledWith(3, "default");
    });
  });
});
