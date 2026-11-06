// ---------------------------------------------------------------------------
// coverage-mask/add — Enter add mode (shortcut K)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE } from "$lib/state/viewport.svelte";
import { doAdd, invalidate, makeAction } from "./_shared";

export const command = {
  name: "coverage-mask-add",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, "idah-video:coverage-mask-bbox", "idah-video:coverage-mask-bbox-remove"] as string[],
  shortcut: "K" as string | null,
  shortDescription: "Done Area — Add mode",
  longDescription: "Enter add mode to draw coverage mask rectangles",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => makeAction(command, () => { doAdd(); invalidate(driver); }),
    group: command.group,
  });
}