import type { IdahDriverV2 } from "..";

export function register(driver: IdahDriverV2) {
  driver.command.register({
    name: "core.toggle_editor_review",
    group: "General",
    modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
    shortcut: "Alt+Tab",
    shortDescription: "Toggle Editor/Review",
    longDescription: "Switch between Editor and Review workspaces",
    callback: () => ({
      command: {
        name: "core.toggle_editor_review",
        group: "General",
        modes: [],
        shortcut: null,
        shortDescription: null,
        longDescription: null,
      },
      do() {
        if (driver.mode === "editor") {
          driver.setMode("review");
        } else if (driver.mode === "review" || driver.mode === "note") {
          driver.setMode("editor");
        } else {
          // In a drawing tool — go to editor
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
