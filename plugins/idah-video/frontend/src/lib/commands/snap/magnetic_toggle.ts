// ---------------------------------------------------------------------------
// snap/magnetic_toggle — Toggle magnetic snap on/off
// Shortcut: Shift+S
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { magneticSnap } from "$lib/state/magnetic-snap.svelte";

export const command = {
  name: "snap.magnetic_toggle",
  group: "Tools",
  modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
  shortcut: "Shift+S",
  shortDescription: "Toggle magnetic snap",
  longDescription: "Enable or disable magnetic snap-to-edge for drawing tools",
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
        magneticSnap.toggle();
        driver.toolbar.invalidate();
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
