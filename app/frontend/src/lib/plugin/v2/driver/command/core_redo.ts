import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.redo",
    group: "General",
    // TODO modes ['*'] ?
    modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
    shortcut: "Control+Shift+Z",
    shortDescription: "Redo",
    longDescription: "Redo the last undone action",
    callback: () => ({
      command: {
        name: "core.redo",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {
        driver.commandMgr.redo();
      },
      isCombinable() {
        return false;
      },
      combine(p) {
        return p;
      },
    }),
  });
}
