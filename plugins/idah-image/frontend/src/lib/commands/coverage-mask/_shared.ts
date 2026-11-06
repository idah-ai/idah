// ---------------------------------------------------------------------------
// coverage-mask/_shared — Shared helpers for coverage mask commands
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { DEFAULT_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";

export function doOff() {
  ui.coverageMaskActive = false;
  if (viewport.isCoverageMaskMode) viewport.mode = DEFAULT_MODE;
}

export function doAdd() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = false;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = COVERAGE_MASK_BBOX;
}

export function doRemove() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = true;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = COVERAGE_MASK_BBOX_REMOVE;
}

export function invalidate(driver: { settings: { invalidate(): void }; toolbar: { invalidate(): void } }): void {
  driver.settings.invalidate();
  driver.toolbar.invalidate();
}
