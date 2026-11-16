// ---------------------------------------------------------------------------
// coverage-mask/_shared — Shared helpers for coverage mask commands
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { session } from "$lib/mask/coverage-mask-session";
import {
  DEFAULT_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_MASK,
  IMAGE_POLYGON,
  REVIEW_MODE,
} from "$lib/types";

/**
 * Modes where the Done Area tools are available: the resting modes plus every drawing tool,
 * so the menu and its shortcuts don't disappear while a shape tool is on. Add/remove itself
 * only runs in a resting mode — see {@link leaveDrawingTool}.
 */
export const DONE_AREA_MODES: string[] = [
  DEFAULT_MODE,
  REVIEW_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_POLYGON,
  IMAGE_MASK,
  IMAGE_LINE,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
];

/**
 * Switch from a drawing tool back to the resting mode before add/remove turns on, so only one
 * tool is ever active. setMode notifies listeners synchronously, so the mode watcher (which
 * turns Done Area off) has run before the caller turns it on.
 */
function leaveDrawingTool(driver: Pick<IIdahDriverV2, "mode" | "setMode">) {
  if (driver.mode !== DEFAULT_MODE && driver.mode !== REVIEW_MODE) driver.setMode(DEFAULT_MODE);
}

export function doOff() {
  ui.coverageMaskActive = false;
}

/** Make the Done Area visible — the add, remove and clear tools act on it, so it must be seen. */
export function showMask() {
  if (ui.coverageMaskVisible) return;
  ui.coverageMaskVisible = true;
  session.triggerRedraw();
}

/**
 * Hide the Done Area. Add and remove draw on an area that can't be seen while it is hidden,
 * so hiding also leaves those modes (and drops a rectangle being dragged).
 */
export function hideMask() {
  doOff();
  if (!ui.coverageMaskVisible) return;
  ui.coverageMaskVisible = false;
  session.triggerRedraw();
}

export function doAdd(driver: Pick<IIdahDriverV2, "mode" | "setMode">) {
  leaveDrawingTool(driver);
  showMask();
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = false;
}

export function doRemove(driver: Pick<IIdahDriverV2, "mode" | "setMode">) {
  leaveDrawingTool(driver);
  showMask();
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
