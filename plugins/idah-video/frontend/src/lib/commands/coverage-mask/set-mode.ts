// ---------------------------------------------------------------------------
// coverage-mask/set-mode — Set mask mode (internal, called by toolbar button)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { EDITOR_MODE, REVIEW_MODE } from "$lib/state/viewport.svelte";
import { doOff, doAdd, doRemove, invalidate, makeAction } from "./_shared";

export const command = {
  name: "coverage-mask-set-mode",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE] as string[],
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
      return makeAction(command, () => {
        if (mode === "off") doOff();
        else if (mode === "add") doAdd();
        else if (mode === "remove") doRemove();
        invalidate(driver);
      });
    },
    group: command.group,
  });
}