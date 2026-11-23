// ---------------------------------------------------------------------------
// coverage-mask/exit — Leave Done Area add/remove mode (shortcut Escape)
//
// Done Area is a flag inside the resting mode, not a driver mode, so the core
// `core:mode.exit` Escape command cannot leave it. This command is only active
// while add or remove is on; `activeWhen` makes it win the Escape key over the
// core command. Leaving the mode also cancels a rectangle being dragged.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "$lib/state/ui.svelte";
import { DEFAULT_MODE, REVIEW_MODE } from "$lib/types";
import { doOff, invalidate } from "./_shared";

export const command = {
  name: "coverage-mask-exit",
  group: "Coverage Mask",
  modes: [DEFAULT_MODE, REVIEW_MODE] as string[],
  shortcut: "Escape" as string | null,
  shortDescription: "Done Area — Exit",
  longDescription: "Leave Done Area add or remove mode",
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
      do() {
        doOff();
        invalidate(driver);
      },
      isCombinable() { return false; },
      combine(p: any) { return p; },
    }),
    group: command.group,
    activeWhen: () => ui.coverageMaskActive,
  });
}
