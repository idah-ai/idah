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

/**
 * UI state — dialogs, panels, etc.
 */
class UIState {
  #frameStep = createLocalStorageStore("idah-video:settings:frame-step", 10);
  #colorMode = createLocalStorageStore<ColorMode>("idah-video:settings:color-mode", "category");
  #renderMode = createLocalStorageStore<RenderMode>("idah-video:settings:render-mode", "bilinear");

  isCommandDialogOpen = $state(false);

  toggleCommandDialog() {
    this.isCommandDialogOpen = !this.isCommandDialogOpen;
  }

  get frameStep() { return this.#frameStep.value; }
  set frameStep(value) { this.#frameStep.value = value }

  get colorMode(): ColorMode { return this.#colorMode.value; }
  set colorMode(value: ColorMode) { this.#colorMode.value = value }

  get renderMode(): RenderMode { return this.#renderMode.value; }
  set renderMode(value: RenderMode) { this.#renderMode.value = value }
}

export const ui = new UIState();
