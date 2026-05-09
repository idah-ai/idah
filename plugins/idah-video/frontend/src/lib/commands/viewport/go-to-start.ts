// ---------------------------------------------------------------------------
// viewport.go_to_start — Jump to the first frame
// Shortcut: Ctrl+Alt+ArrowLeft
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import { platformShortcut } from "$lib/utils/browser";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.go_to_start",
  group: "Viewport",
  modes: ["default", "review"],
  shortcut: platformShortcut("Control+Alt+ArrowLeft") as string | null,
  shortDescription: "Go to start",
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
        viewport.video.currentFrame.value = 0;
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
