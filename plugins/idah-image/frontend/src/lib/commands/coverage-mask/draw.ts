// ---------------------------------------------------------------------------
// coverage-mask/draw — Undoable mask shape draw/erase (called by ShapesContainer)
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";
import { invalidate } from "./_shared";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "coverage-mask-draw",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE] as string[],
  shortcut: null as string | null,
  shortDescription: null as string | null,
  longDescription: null as string | null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts) => {
      if (!isEditable()) {
        return {
          command: { ...command },
          do() {},
          isCombinable() { return false; },
          combine(p) { return p; },
        };
      }

      const { before, after } = opts ?? {};
      return {
        command: { ...command },
        do() { if (after) ui.coverageMaskShapes = after as any; invalidate(driver); driver.command.call("coverage-mask-save"); },
        undo() { if (before) ui.coverageMaskShapes = before as any; invalidate(driver); driver.command.call("coverage-mask-save"); },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
