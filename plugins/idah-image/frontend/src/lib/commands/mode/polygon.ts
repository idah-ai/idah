// plugins/idah-image/frontend/src/lib/commands/mode/polygon.ts
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "mode.polygon",
  group: "Tools",
  modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
  shortcut: "P",
  shortDescription: "Polygon",
  longDescription: "Polygon Tool",
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
        if (driver.mode !== "idah-image:polygon") {
          driver.setMode("idah-image:polygon");
        }
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
