// ---------------------------------------------------------------------------
// coverage-mask/coverage_set_mode — Coverage mask commands
//
// Commands:
//   1. coverage-mask-add      — enter add mode  (shortcut M)
//   2. coverage-mask-remove   — enter remove mode (shortcut Shift+M)
//   3. coverage-mask-clear    — remove all shapes (shortcut Ctrl+Shift+M)
//   4. coverage-mask-set-mode — internal: called by toolbar to set mode
//   5. coverage-mask-draw     — undoable add/remove of mask shapes
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { viewport } from "$lib/state/viewport.svelte";

import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE } from "$lib/types";

function doOff() {
  ui.coverageMaskActive = false;
  if (viewport.isCoverageMaskMode) viewport.mode = DEFAULT_MODE;
}

function doAdd() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = false;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = "idah-image:coverage-mask-bbox";
}

function doRemove() {
  ui.coverageMaskActive = true;
  ui.coverageMaskIsRemove = true;
  ui.coverageMaskToolType = "bbox";
  viewport.mode = "idah-image:coverage-mask-bbox-remove";
}

function invalidate(driver: IIdahDriverV2) { driver.settings.invalidate(); driver.toolbar.invalidate(); }

function makeAction(cmd: any, doFn: () => void, u?: () => void) {
  return { command: { ...cmd }, do: doFn, undo: u, isCombinable: () => false, combine: (p: any) => p };
}

function reg(d: IIdahDriverV2, cmd: any, cb: (o: any) => any) { d.command.register({ ...cmd, callback: cb }); }

export const addCommand = { name: "coverage-mask-add", group: "Coverage Mask", modes: [DEFAULT_MODE, REVIEW_MODE, "idah-image:coverage-mask-bbox", "idah-image:coverage-mask-bbox-remove"] as string[], shortcut: "K" as string | null, shortDescription: "Done Area — Add mode", longDescription: null };
export const removeCommand = { name: "coverage-mask-remove", group: "Coverage Mask", modes: [DEFAULT_MODE, REVIEW_MODE, "idah-image:coverage-mask-bbox", "idah-image:coverage-mask-bbox-remove"] as string[], shortcut: "Shift+K" as string | null, shortDescription: "Done Area — Remove mode", longDescription: null };
export const clearCommand = { name: "coverage-mask-clear", group: "Coverage Mask", modes: [DEFAULT_MODE, REVIEW_MODE] as string[], shortcut: "Control+Shift+K" as string | null, shortDescription: "Done Area — Clear all", longDescription: null };
export const modeCommand = { name: "coverage-mask-set-mode", group: "Coverage Mask", modes: [DEFAULT_MODE, REVIEW_MODE] as string[], shortcut: null as string | null, shortDescription: null, longDescription: null };
export const drawCommand = { name: "coverage-mask-draw", group: "Coverage Mask", modes: [DEFAULT_MODE, REVIEW_MODE, "idah-image:coverage-mask-bbox", "idah-image:coverage-mask-bbox-remove"] as string[], shortcut: null as string | null, shortDescription: null, longDescription: null };

export function register(driver: IIdahDriverV2): void {
  reg(driver, addCommand, () => makeAction(addCommand, () => { doAdd(); invalidate(driver); }));
  reg(driver, removeCommand, () => makeAction(removeCommand, () => { doRemove(); invalidate(driver); }));
  reg(driver, clearCommand, (o) => {
    const before = [...ui.coverageMaskShapes];
    return makeAction(clearCommand, () => { ui.coverageMaskShapes = []; doOff(); invalidate(driver); }, () => { ui.coverageMaskShapes = before; invalidate(driver); });
  });
  reg(driver, modeCommand, (o) => {
    const { mode } = o ?? {};
    return makeAction(modeCommand, () => {
      if (mode === "off") doOff(); else if (mode === "add") doAdd(); else if (mode === "remove") doRemove();
      invalidate(driver);
    });
  });
  reg(driver, drawCommand, (o) => {
    const { before, after } = o ?? {};
    return makeAction(drawCommand,
      () => { if (after) ui.coverageMaskShapes = after as any; invalidate(driver); },
      () => { if (before) ui.coverageMaskShapes = before as any; invalidate(driver); },
    );
  });
}
