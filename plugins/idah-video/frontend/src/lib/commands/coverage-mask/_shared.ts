import { ui } from "$lib/state/ui.svelte";
import { viewport, EDITOR_MODE } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export function doOff() {
  ui.coverageMaskActive = false;
  if (viewport.isCoverageMaskMode) viewport.mode = EDITOR_MODE;
}

export function doAdd() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = false;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = "idah-video:coverage-mask-bbox";
}

export function doRemove() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = true;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = "idah-video:coverage-mask-bbox-remove";
}

export function invalidate(driver: { settings: { invalidate(): void }; toolbar: { invalidate(): void } }): void {
  driver.settings.invalidate();
  driver.toolbar.invalidate();
}
