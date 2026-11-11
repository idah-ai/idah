// ---------------------------------------------------------------------------
// coverage-mask/clear — Remove all mask shapes (shortcut Ctrl+Shift+K, undoable)
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";
import { data } from "$lib/state/data.svelte";
import { COVERAGE_DONE_AREA } from "$lib/types";
import { doOff, invalidate } from "./_shared";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "coverage-mask-clear",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE] as string[],
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
      if (!isEditable()) {
        return {
          command: { ...command },
          do() {},
          isCombinable() { return false; },
          combine(p) { return p; },
        };
      }
      const before = [...ui.coverageMaskShapes];
      const annId = data.annotations?.items?.find(a => a.shape_type === COVERAGE_DONE_AREA)?.id;
      return {
        command: { ...command },
        do() { ui.coverageMaskShapes = []; doOff(); invalidate(driver); driver.command.call("coverage-mask-save"); },
        undo() { ui.coverageMaskShapes = before; invalidate(driver); driver.command.call("coverage-mask-save", { restoreAnnId: annId }); },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
