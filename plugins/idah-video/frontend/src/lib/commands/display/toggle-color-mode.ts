// ---------------------------------------------------------------------------
// toggle-color-mode — Switch between "category" and "random" color mode
// Shortcut: None (available in the command palette)
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui, type ColorMode } from "$lib/state/ui.svelte";

export const command = {
  name: "idah-video:ui.toggle-color-mode",
  group: "Display",
  modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
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
    // opts.value sets an explicit mode (settings menu); no opts toggles (shortcut).
    callback: (opts) => ({
      command: { ...command },
      do() {
        const value = opts?.value as ColorMode | undefined;
        ui.colorMode = value ?? ((ui.colorMode === "category" ? "random" : "category") as ColorMode);
        driver.settings.invalidate();
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
