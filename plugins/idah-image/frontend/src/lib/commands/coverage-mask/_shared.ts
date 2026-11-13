// ---------------------------------------------------------------------------
// coverage-mask/_shared — Shared helpers for coverage mask commands
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { DEFAULT_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";

// Track the mode before entering coverage mode, so doOff can restore it
let _previousMode: string | null = null;

export function doOff() {
  ui.coverageMaskActive = false;
  // ui.coverageMaskVisible = false;
  if (viewport.isCoverageMaskMode) {
    viewport.mode = _previousMode ?? DEFAULT_MODE;
  }
  _previousMode = null;
}

export function doAdd() {
  _previousMode = viewport.mode;
  ui.coverageMaskActive = true;
  // ui.coverageMaskVisible = true;
  ui.coverageMaskIsRemove = false;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = COVERAGE_MASK_BBOX;
}

export function doRemove() {
  _previousMode = viewport.mode;
  ui.coverageMaskActive = true;
  // ui.coverageMaskVisible = true;
  ui.coverageMaskIsRemove = true;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = COVERAGE_MASK_BBOX_REMOVE;
}

export function invalidate(driver: { settings: { invalidate(): void }; toolbar: { invalidate(): void } }): void {
  driver.settings.invalidate();
  driver.toolbar.invalidate();
}
