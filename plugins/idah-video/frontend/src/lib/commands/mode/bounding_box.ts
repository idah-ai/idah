// plugins/idah-video/frontend/src/lib/commands/mode/bounding_box.ts
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "mode.idah-video:bounding_box",
  group: "Tools",
  modes: ["default", "idah-video:bounding-box", "idah-video:polygon", "note"],
  shortcut: "B",
  shortDescription: "Bounding Box",
  longDescription: "Bounding Box Tool",
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
        if (driver.mode !== "idah-video:bounding-box") {
          driver.setMode("idah-video:bounding-box");
        }
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
