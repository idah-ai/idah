// ---------------------------------------------------------------------------
// coverage-mask/draw — Undoable mask shape draw/erase (called by ShapesContainer)
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";
import { invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-draw",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE] as string[],
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
      const { before, after } = opts ?? {};
      return {
        command: { ...command },
        do() { if (after) ui.coverageMaskShapes = after as any; invalidate(driver); },
        undo() { if (before) ui.coverageMaskShapes = before as any; invalidate(driver); },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
