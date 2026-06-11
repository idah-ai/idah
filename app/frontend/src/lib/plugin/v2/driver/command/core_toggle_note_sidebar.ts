import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.toggle_note_sidebar",
    group: "General",
    modes: ["review", "note"],
    shortcut: "Control+Shift+N",
    shortDescription: "Toggle note sidebar",
    longDescription: "Show/hide the note sidebar in review workspace",
    callback: () => ({
      command: {
        name: "core.toggle_note_sidebar",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {
        driver.toggleNoteSidebar();
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
