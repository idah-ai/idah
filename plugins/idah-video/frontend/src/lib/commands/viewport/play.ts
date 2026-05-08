// ---------------------------------------------------------------------------
// viewport.play — Toggle video play / pause
// Shortcut: Space
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.play",
  group: "Viewport",
  modes: ["default", "review"],
  shortcut: "Space",
  shortDescription: "Play / Pause",
  longDescription: "Toggle video playback",
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
        if (viewport.video.status === "play") {
          viewport.video.pause();
        } else {
          viewport.video.play();
        }
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
