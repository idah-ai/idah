// plugins/idah-image/frontend/src/lib/commands/mode/select.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, NOTE_MODE, REVIEW_MODE } from "$lib/types";

export const command = {
  name: "mode.select",
  group: "Tools",
  modes: [DEFAULT_MODE, REVIEW_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, NOTE_MODE],
  shortcut: "D",
  shortDescription: "Select",
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
        driver.setMode(DEFAULT_MODE);
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
