// ---------------------------------------------------------------------------
// toggle-time-display — Switch between "frames" and "time" timeline display
// Shortcut: None (available in the command palette)
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui, type TimeDisplay } from "$lib/state/ui.svelte";

export const command = {
  name: "ui.toggle_time_display",
  group: "Display",
  modes: ["default", "review", "idah-image:bounding-box", "idah-image:polygon", "note"],
  shortcut: null,
  shortDescription: "Toggle timeline time display",
  longDescription: "Switch between showing frame numbers and time (m:ss.ff) on the timeline ruler",
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
        ui.timeDisplay = (ui.timeDisplay === "frames" ? "time" : "frames") as TimeDisplay;
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
