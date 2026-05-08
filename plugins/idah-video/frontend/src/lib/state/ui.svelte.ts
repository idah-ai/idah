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

/** Frame step for skip-forward/backward. */
export const frameStep = createLocalStorageStore("idah-video:settings:frame-step", 10);

/**
 * UI state — dialogs, panels, etc.
 */
class UIState {
  isCommandDialogOpen = $state(false);

  toggleCommandDialog() {
    this.isCommandDialogOpen = !this.isCommandDialogOpen;
  }
}

export const ui = new UIState();
