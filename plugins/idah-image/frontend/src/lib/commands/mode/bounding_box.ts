// plugins/idah-image/frontend/src/lib/commands/mode/bounding_box.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON } from "$lib/types";

export const command = {
  name: "mode.bounding_box",
  group: "Tools",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON],
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
        if (driver.mode !== BOUNDING_BOX_MODE) {
          driver.setMode(BOUNDING_BOX_MODE);
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
