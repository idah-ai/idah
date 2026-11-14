// ---------------------------------------------------------------------------
// coverage-mask/add — Enter add mode (shortcut K)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE } from "$lib/types";
import { doAdd, invalidate } from "./_shared";
import { isEditable } from "$lib/state/editor.svelte";


export const command = {
  name: "coverage-mask-add",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE, ] as string[],
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
    callback: () => {
      if (!isEditable()) {
        return {
          command: { ...command },
          do() {},
          isCombinable() { return false; },
          combine(p) { return p; },
        };
      }

      return {
        command: { ...command },
        do() { doAdd(); invalidate(driver); },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
