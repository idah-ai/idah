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
  modes: ["default", "review"],
  shortcut: "ArrowLeft" as string | null,
  shortDescription: "Previous frame",
  longDescription: "Move backward one frame",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    () => ({
      command: { ...command },
      do() {
        const current = viewport.video.currentFrame.value;
        viewport.video.currentFrame.value = Math.max(current - 1, 0);
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    command.group,
  );
}
