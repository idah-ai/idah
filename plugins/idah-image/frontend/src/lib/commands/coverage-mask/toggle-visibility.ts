// ---------------------------------------------------------------------------
// coverage-mask/toggle-visibility — Hide or show the Done Area (shortcut H)
//
// Shares its name with the toolbar item, so the menu shows the shortcut next to
// Hide/Show. Hiding also leaves add/remove (see hideMask). View-only, so it is
// available even when the entry is not editable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "$lib/state/ui.svelte";
import { DONE_AREA_MODES, hideMask, invalidate, showMask } from "./_shared";

export const command = {
  name: "coverage-mask-toggle-visibility",
  group: "Coverage Mask",
  modes: DONE_AREA_MODES,
  shortcut: "H" as string | null,
  shortDescription: "Done Area — Hide / Show",
  longDescription: "Hide or show the Done Area overlay",
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
        if (ui.coverageMaskVisible) hideMask();
        else showMask();
        invalidate(driver);
      },
      isCombinable() { return false; },
      combine(p: any) { return p; },
    }),
    group: command.group,
  });
}
