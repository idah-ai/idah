// ---------------------------------------------------------------------------
// timeline.go_to_last — Jump to the last frame
// Shortcut: Ctrl+Shift+ArrowRight
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "timeline.go_to_last",
  group: "Timeline",
  modes: ["default", "review"],
  shortcut: "Control+Shift+ArrowRight",
  shortDescription: "Go to last frame",
  longDescription: "Jump to the last frame",
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
        viewport.video.currentFrame.value = media.totalFrames - 1;
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
