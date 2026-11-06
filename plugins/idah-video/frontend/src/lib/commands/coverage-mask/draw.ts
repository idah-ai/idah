// ---------------------------------------------------------------------------
// coverage-mask/draw — Undoable mask shape draw/erase (called by ShapesContainer)
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE } from "$lib/state/viewport.svelte";
import { invalidate, makeAction } from "./_shared";

export const command = {
  name: "coverage-mask-draw",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, "idah-video:coverage-mask-bbox", "idah-video:coverage-mask-bbox-remove"] as string[],
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
      return makeAction(command,
        () => { if (after) ui.coverageMaskShapes = after as any; invalidate(driver); },
        () => { if (before) ui.coverageMaskShapes = before as any; invalidate(driver); },
      );
    },
    group: command.group,
  });
}