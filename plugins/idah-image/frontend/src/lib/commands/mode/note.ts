// plugins/idah-image/frontend/src/lib/commands/mode/note.ts
import type { IIdahDriverV2 } from "$idah/v2/types";
import { NOTE_MODE, REVIEW_MODE } from "$lib/types";

export const command = {
  name: "mode.note",
  group: "Tools",
  modes: [REVIEW_MODE, NOTE_MODE],
  shortcut: "N",
  shortDescription: "Note",
  longDescription: "Note Tool",
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
        driver.setMode(NOTE_MODE);
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
