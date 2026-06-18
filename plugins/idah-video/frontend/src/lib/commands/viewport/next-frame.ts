// ---------------------------------------------------------------------------
// viewport.next_frame — Advance one frame forward
// Shortcut: ArrowRight
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.next_frame",
  group: "Viewport",
  modes: ["editor", "review"],
  shortcut: "ArrowRight",
  shortDescription: "Next frame",
  longDescription: "Move forward one frame",
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
        const current = viewport.video.currentFrame.value;
        viewport.video.currentFrame.value = Math.min(current + 1, media.totalFrames - 1);
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
