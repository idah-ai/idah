// ---------------------------------------------------------------------------
// timeline.go_to_first — Jump to the first frame
// Shortcut: Ctrl+Shift+ArrowLeft
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "timeline.go_to_first",
  group: "Timeline",
  modes: ["default", "review"],
  shortcut: "Control+Shift+ArrowLeft",
  shortDescription: "Go to first frame",
  longDescription: "Jump to the first frame",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => ({
      command: { ...command },
      do() {
        viewport.video.goToFrame(0);
      },
      isCombinable() {
        return false;
      },
      combine(prev) {
        return prev;
      },
    }),
    group: command.group,
  });
}
