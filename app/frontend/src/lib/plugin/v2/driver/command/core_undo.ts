import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.undo",
    group: "General",
    // TODO modes ['*'] ?
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    shortcut: "Control+Z",
    shortDescription: "Undo",
    longDescription: "Undo the last action",
    callback: () => ({
      command: {
        name: "core.undo",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {
        driver.commandMgr.undo();
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
