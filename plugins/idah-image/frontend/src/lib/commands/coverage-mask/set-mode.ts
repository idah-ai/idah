// coverage-mask/set-mode — Toggle coverage mask mode on/off (called from header toolbar)
import type { IIdahDriverV2 } from "$idah/v2/types";
import { isEditable } from "$lib/state/editor.svelte";
import { DONE_AREA_MODES, doAdd, doRemove, doOff, invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-set-mode",
  group: "Coverage Mask",
  modes: DONE_AREA_MODES,
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
      const mode = (opts as any)?.mode;
      return {
        command: { ...command },
        do() {
          if (mode === "add") doAdd(driver);
          else if (mode === "remove") doRemove(driver);
          else doOff();
          invalidate(driver);
        },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
