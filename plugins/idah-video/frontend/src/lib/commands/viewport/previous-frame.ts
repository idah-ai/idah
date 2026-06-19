// ---------------------------------------------------------------------------
// viewport.previous_frame — Move one frame backward
// Shortcut: ArrowLeft
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.previous_frame",
  group: "Viewport",
  modes: ["editor", "review"],
  shortcut: "ArrowLeft",
  shortDescription: "Previous frame",
  longDescription: "Move backward one frame",
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
        // stepBy gates on framePending (and clamps), so scrubbing can never
        // run ahead of what is painted on screen.
        viewport.video.stepBy(-1);
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
