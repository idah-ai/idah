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
    get value() {
      return value;
    },
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
 * When the category label is drawn on an annotation.
 *   "always" — always shown
 *   "hover"  — shown only while the annotation is hovered or selected
 *   "never"  — never shown (default)
 */
export type LabelVisibility = "always" | "hover" | "never";

/**
 * UI state — dialogs, panels, etc.
 */
class UIState {
  #frameStep = createLocalStorageStore("idah-image:settings:frame-step", 10);
  #colorMode = createLocalStorageStore<ColorMode>("idah-image:settings:color-mode", "category");
  #renderMode = createLocalStorageStore<RenderMode>("idah-image:settings:render-mode", "bilinear");
  #timeDisplay = createLocalStorageStore<TimeDisplay>("idah-image:settings:time-display", "frames");

  // Opacity is intentionally session-only (in-memory): it resets to the default
  // on every plugin load/registration instead of persisting to localStorage.
  // Plain reactive fields — no getter/setter needed since nothing is saved.
  annotationOpacity = $state(100);
  imageOpacity = $state(100);

  // Persisted per-plugin to account settings (not localStorage): hydrated from
  // the account setting on init via settings.ts#hydrateSettings, and written back
  // on change via the settings descriptor's set() (upsert). "never" is the
  // fallback used before load completes or when unauthenticated.
  labelVisibility = $state<LabelVisibility>("never");

  isCommandDialogOpen = $state(false);
  isDebugConsoleOpen = $state(false);

  toggleCommandDialog() {
    this.isCommandDialogOpen = !this.isCommandDialogOpen;
  }

  toggleDebugConsole() {
    this.isDebugConsoleOpen = !this.isDebugConsoleOpen;
  }

  get frameStep() {
    return this.#frameStep.value;
  }
  set frameStep(value) {
    this.#frameStep.value = value;
  }

  get colorMode(): ColorMode {
    return this.#colorMode.value;
  }
  set colorMode(value: ColorMode) {
    this.#colorMode.value = value;
  }

  get renderMode(): RenderMode {
    return this.#renderMode.value;
  }
  set renderMode(value: RenderMode) {
    this.#renderMode.value = value;
  }

  get timeDisplay(): TimeDisplay {
    return this.#timeDisplay.value;
  }
  set timeDisplay(value: TimeDisplay) {
    this.#timeDisplay.value = value;
  }
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
