// ---------------------------------------------------------------------------
// viewport.skip_backward — Skip backward by the configured frame step
// Shortcut: Shift+ArrowLeft
// Not undoable.
// ---------------------------------------------------------------------------
import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import { viewport } from "$lib/state/viewport.svelte";
import { ui } from "$lib/state/ui.svelte";

function makeAction(): ICommandAction {
  const step = ui.frameStep;
  return {
    command: { name: "viewport.skip_backward", group: "Viewport", modes: ["default", "review"], shortcut: null, shortDescription: "Skip backward", longDescription: "Jump backward by the configured number of frames" },
    do() {
      // stepBy gates on framePending (and clamps), so scrubbing can never
      // run ahead of what is painted on screen.
      viewport.video.stepBy(-step);
    },
    isCombinable() { return false; },
    combine(prev: ICommandAction) { return prev; },
  };
}

export const command = {
  name: "viewport.skip_backward",
  group: "Viewport",
  modes: ["editor", "review"] as string[],
  shortcut: "Shift+ArrowLeft",
  shortDescription: "Skip backward",
  longDescription: "Jump backward by the configured number of frames",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => makeAction(),
    group: command.group,
  });
}
