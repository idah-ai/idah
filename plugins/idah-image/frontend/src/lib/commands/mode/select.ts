// plugins/idah-image/frontend/src/lib/commands/mode/select.ts
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "mode.select",
  group: "Tools",
  modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
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
        driver.setMode("default");
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
