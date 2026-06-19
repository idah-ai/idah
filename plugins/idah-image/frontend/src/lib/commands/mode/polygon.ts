// plugins/idah-image/frontend/src/lib/commands/mode/polygon.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON } from "$lib/types";

export const command = {
  name: "mode.polygon",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON],
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
        if (driver.mode !== IMAGE_POLYGON) {
          driver.setMode(IMAGE_POLYGON);
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
