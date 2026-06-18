import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.palette",
    group: "General",
    // TODO modes ['*'] ?
    modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
    shortcut: "Control+Space",
    shortDescription: null,
    longDescription: null,
    callback: () => ({
      command: {
        name: "core.palette",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {},
      isCombinable() {
        return false;
      },
      combine(p) {
        return p;
      },
    }),
  });
}
