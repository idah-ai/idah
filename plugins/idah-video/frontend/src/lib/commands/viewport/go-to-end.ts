// ---------------------------------------------------------------------------
// viewport.go_to_end — Jump to the last frame
// Shortcut: Ctrl+Alt+ArrowRight
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.go_to_end",
  group: "Viewport",
  modes: ["default", "review"],
  shortcut: "Control+Alt+ArrowRight" as string | null,
  shortDescription: "Go to end",
  longDescription: "Jump to the last frame",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    () => ({
      command: { ...command },
      do() {
        viewport.video.currentFrame.value = media.totalFrames - 1;
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    command.group,
  );
}
