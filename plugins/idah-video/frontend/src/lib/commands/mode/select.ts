// plugins/idah-video/frontend/src/lib/commands/mode/select.ts
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "mode.selection",
  group: "Tools",
  modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
  shortcut: "D",
  shortDescription: "Selection",
  longDescription: "Selection Tool",
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
        // Return to the parent resting mode of the current workspace
        if (driver.mode === "review" || driver.mode === "note") {
          driver.setMode("review");
        } else {
          driver.setMode("editor");
        }
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
