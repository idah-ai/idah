// ---------------------------------------------------------------------------
// viewport.skip_backward — Skip backward by the configured frame step
// Shortcut: Shift+ArrowLeft
// Not undoable.
// ---------------------------------------------------------------------------
import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import { viewport } from "$lib/state/viewport.svelte";
import { frameStep } from "$lib/state/ui.svelte";

function makeAction(): ICommandAction {
  const current = viewport.video.currentFrame.value;
  const step = frameStep.value;
  return {
    command: { name: "viewport.skip_backward", group: "Viewport", modes: ["default", "review"], shortcut: null, shortDescription: "Skip backward", longDescription: "Jump backward by the configured number of frames" },
    do() {
      viewport.video.currentFrame.value = Math.max(current - step, 0);
    },
    isCombinable() { return false; },
    combine(prev: ICommandAction) { return prev; },
  };
}

export const command = {
  name: "viewport.skip_backward",
  group: "Viewport",
  modes: ["default", "review"] as string[],
  shortcut: "Shift+ArrowLeft" as string | null,
  shortDescription: "Skip backward",
  longDescription: "Jump backward by the configured number of frames",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    () => makeAction(),
    command.group,
  );
}
