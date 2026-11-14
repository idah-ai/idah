// ---------------------------------------------------------------------------
// coverage-mask/_shared — Shared helpers for coverage mask commands
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { DEFAULT_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";

// Track the mode before entering coverage mode, so doOff can restore it
let _previousMode: string | null = null;

export function doOff() {
  if (viewport.isCoverageMaskMode) {
    viewport.mode = _previousMode ?? DEFAULT_MODE;
  }
  _previousMode = null;
}

export function doAdd() {
  if (!viewport.isCoverageMaskMode) {
    _previousMode = viewport.mode;
  }
  ui.coverageMaskIsRemove = false;
  viewport.mode = COVERAGE_MASK_BBOX;
}

export function doRemove() {
  if (!viewport.isCoverageMaskMode) {
    _previousMode = viewport.mode;
  }
  ui.coverageMaskIsRemove = true;
  viewport.mode = COVERAGE_MASK_BBOX_REMOVE;
}

export function invalidate(driver: { settings: { invalidate(): void }; toolbar: { invalidate(): void } }): void {
  driver.settings.invalidate();
  driver.toolbar.invalidate();
}
