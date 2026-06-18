import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.retry",
    group: "General",
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    shortcut: null,
    shortDescription: "Retry sync",
    longDescription:
      "Resume syncing pending operations after a network or server error. " +
      "If the error persists, use Reset cache to discard local changes and reload from the server.",
    callback: () => ({
      command: {
        name: "core.retry",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {
        driver.resumeSync();
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
