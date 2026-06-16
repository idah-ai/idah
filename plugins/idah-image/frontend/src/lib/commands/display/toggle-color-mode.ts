// ---------------------------------------------------------------------------
// toggle-color-mode — Switch between "category" and "random" color mode
// Shortcut: None (available in the command palette)
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui, type ColorMode } from "$lib/state/ui.svelte";

export const command = {
  name: "ui.toggle_color_mode",
  group: "Display",
  modes: ["default", "review", "idah-image:bounding-box", "idah-image:polygon", "note"],
  shortcut: null,
  shortDescription: "Toggle annotation color mode",
  longDescription: "Switch between category-based colors and random colors for annotations",
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
        ui.colorMode = (ui.colorMode === "category" ? "random" : "category") as ColorMode;
      },
      isCombinable() {
        return false;
      },
      combine(p) {
        return p;
      },
    }),
    group: command.group,
  });
}
