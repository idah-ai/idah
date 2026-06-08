import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.exit_mode",
    group: "General",
    // TODO modes ['*'] ?
    modes: [
      "default",
      "review",
      "idah-video:bounding-box",
      "idah-video:polygon",
      "idah-image:bounding-box",
      "idah-image:polygon",
      "note",
    ],
    shortcut: "Escape",
    shortDescription: "Exit current mode",
    longDescription: "Return to the default selection mode",
    callback: () => ({
      command: {
        name: "core.exit_mode",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
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
  });
}
