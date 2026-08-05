// plugins/idah-image/frontend/src/lib/commands/mode/ellipse.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK } from "$lib/types";

export const command = {
  name: "mode.ellipse",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_LINE, IMAGE_POLYGON, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_MASK],
  shortcut: "E",
  shortDescription: "Ellipse",
  longDescription: "Ellipse Tool",
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
        if (driver.mode !== IMAGE_ELLIPSE) {
          driver.setMode(IMAGE_ELLIPSE);
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
