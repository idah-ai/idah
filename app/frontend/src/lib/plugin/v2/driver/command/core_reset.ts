import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.reset",
    group: "General",
    // TODO modes ['*'] ?
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    shortcut: null,
    shortDescription: "Reset cache and reload",
    longDescription: "Reset cache and reload",
    callback: () => ({
      command: {
        name: "core.reset",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      async do() {
        await driver.resetCache();
        window.location.reload();
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
