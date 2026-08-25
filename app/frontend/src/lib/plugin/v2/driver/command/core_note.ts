import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core:tool.note",
    group: "Tools",
    modes: ["review", "note"],
    shortcut: "N",
    shortDescription: "Note",
    longDescription: "Note Tool",
    callback: () => ({
      command: {
        name: "core:tool.note",
        group: "Tools",
        modes: ["review", "note"],
        shortcut: "N",
        shortDescription: "Note",
        longDescription: "Note Tool",
      },
      do() {
        driver.setMode("note");
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
