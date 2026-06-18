import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.exit_mode",
    group: "General",
    // TODO modes ['*'] ?
    modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
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
        // Escape from tool modes returns to the parent resting mode
        if (driver.mode === "note") {
          driver.setMode("review");
        } else {
          driver.setMode("editor");
        }
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
