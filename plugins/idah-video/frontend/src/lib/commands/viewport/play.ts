// ---------------------------------------------------------------------------
// viewport.play — Toggle video play / pause
// Shortcut: Space
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.play",
  modes: ["default", "review"],
  shortcut: [null, "Space"] as [string | null, string],
  shortDescription: "Play / Pause",
  longDescription: "Toggle video playback",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    () => ({
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
  );
}
