// ---------------------------------------------------------------------------
// coverage-mask/set-mode — Set mask mode (internal, called by toolbar button)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, REVIEW_MODE } from "$lib/types";
import { doOff, doAdd, doRemove, invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-set-mode",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE] as string[],
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
      const { mode } = opts ?? {};
      return {
        command: { ...command },
        do() {
          if (mode === "off") doOff();
          else if (mode === "add") doAdd();
          else if (mode === "remove") doRemove();
          invalidate(driver);
        },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
