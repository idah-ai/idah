// ---------------------------------------------------------------------------
// ui.svelte.ts — UI state store (command dialog, local storage)
// ---------------------------------------------------------------------------

/**
 * UI preferences stored in localStorage.
 */
function createLocalStorageStore<T>(key: string, defaultValue: T) {
  let value = $state<T>(defaultValue);

  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      value = JSON.parse(stored) as T;
    }
  } catch {
    // ignore
  }

  return {
    get value() { return value; },
    set value(v: T) {
      value = v;
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // ignore
      }
    },
  };
}

export type ColorMode = "category" | "random";
export type RenderMode = "bilinear" | "nearest-neighbor";
export type TimeDisplay = "frames" | "time";

/**
 * UI state — dialogs, panels, etc.
 */
class UIState {
  #frameStep = createLocalStorageStore("idah-video:settings:frame-step", 10);
  #colorMode = createLocalStorageStore<ColorMode>("idah-video:settings:color-mode", "category");
  #renderMode = createLocalStorageStore<RenderMode>("idah-video:settings:render-mode", "bilinear");
  #timeDisplay = createLocalStorageStore<TimeDisplay>("idah-video:settings:time-display", "frames");

  isCommandDialogOpen = $state(false);
  isDebugConsoleOpen = $state(false);

  toggleCommandDialog() {
    this.isCommandDialogOpen = !this.isCommandDialogOpen;
  }

  toggleDebugConsole() {
    this.isDebugConsoleOpen = !this.isDebugConsoleOpen;
  }

  get frameStep() { return this.#frameStep.value; }
  set frameStep(value) { this.#frameStep.value = value }

  get colorMode(): ColorMode { return this.#colorMode.value; }
  set colorMode(value: ColorMode) { this.#colorMode.value = value }

  get renderMode(): RenderMode { return this.#renderMode.value; }
  set renderMode(value: RenderMode) { this.#renderMode.value = value }

  get timeDisplay(): TimeDisplay { return this.#timeDisplay.value; }
  set timeDisplay(value: TimeDisplay) { this.#timeDisplay.value = value }
}

export const ui = new UIState();

// ── Snap debug info ─────────────────────────────────────────────────────
class SnapDebug {
  enabled = $state(false);
  cursor: [number, number] = $state([0, 0]);
  snapped: [number, number] | null = $state(null);
  kind: string | null = $state(null);
  threshold = $state(0);
  targetCount = $state(0);
  candidates = $state(0);
}

export const snapDebug = new SnapDebug();
