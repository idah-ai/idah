// ---------------------------------------------------------------------------
// coverage-mask/remove — Enter remove mode (shortcut Shift+K)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE } from "$lib/types";
import { doRemove, invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-remove",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE, COVERAGE_MASK_BBOX, COVERAGE_MASK_BBOX_REMOVE] as string[],
  shortcut: "Shift+K" as string | null,
  shortDescription: "Done Area — Remove mode",
  longDescription: "Enter remove mode to erase coverage mask rectangles",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => ({
      command: { ...command },
      do() { doRemove(); invalidate(driver); },
      isCombinable() { return false; },
      combine(p: any) { return p; },
    }),
    group: command.group,
  });
}
