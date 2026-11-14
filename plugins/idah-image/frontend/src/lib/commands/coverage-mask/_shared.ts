// ---------------------------------------------------------------------------
// coverage-mask/_shared — Shared helpers for coverage mask commands
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export function doOff() {
  ui.coverageMaskActive = false;
}

export function doAdd() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = false;
}

export function doRemove() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = true;
}

export function invalidate(driver: { settings: { invalidate(): void }; toolbar: { invalidate(): void } }): void {
  driver.settings.invalidate();
  driver.toolbar.invalidate();
}

/**
 * Register a mode-change listener that deactivates coverage state whenever
 * the user switches to a non-coverage tool (bbox, polygon, note, etc.).
 * Call this once during plugin initialisation.
 */

export function registerCoverageModeWatcher(driver: IIdahDriverV2): void {
  driver.onModeChange(() => {
    if (ui.coverageMaskActive) {
      doOff();
    }
  });
}
