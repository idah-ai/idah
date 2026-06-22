// plugins/idah-image/frontend/src/lib/commands/mode/circle.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_LINE, IMAGE_POLYGON } from "$lib/types";

export const command = {
  name: "mode.circle",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_POLYGON, IMAGE_LINE],
  shortcut: "C",
  shortDescription: "Circle",
  longDescription: "Circle Tool",
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
        if (driver.mode !== IMAGE_CIRCLE) {
          driver.setMode(IMAGE_CIRCLE);
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
