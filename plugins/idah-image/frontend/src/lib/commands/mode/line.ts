// plugins/idah-image/frontend/src/lib/commands/mode/line.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_LINE, IMAGE_POLYGON } from "$lib/types";

export const command = {
  name: "mode.line",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_LINE, IMAGE_POLYGON, IMAGE_CIRCLE],
  shortcut: "L",
  shortDescription: "Line",
  longDescription: "Line Tool",
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
        if (driver.mode !== IMAGE_LINE) {
          driver.setMode(IMAGE_LINE);
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
