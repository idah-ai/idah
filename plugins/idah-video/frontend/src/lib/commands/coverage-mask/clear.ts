// ---------------------------------------------------------------------------
// coverage-mask/clear — Remove all mask shapes (shortcut Ctrl+Shift+K, undoable)
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE } from "$lib/state/viewport.svelte";
import { doOff, invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-clear",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, "idah-video:coverage-mask-bbox", "idah-video:coverage-mask-bbox-remove"] as string[],
  shortcut: "Control+Shift+K" as string | null,
  shortDescription: "Done Area — Clear all",
  longDescription: "Remove all coverage mask shapes",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      const before = [...ui.coverageMaskShapes];
      return {
        command: { ...command },
        do() { ui.coverageMaskShapes = []; doOff(); invalidate(driver); },
        undo() { ui.coverageMaskShapes = before; invalidate(driver); },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}