// ---------------------------------------------------------------------------
// viewport.skip_forward — Skip forward by the configured frame step
// Shortcut: Shift+ArrowRight
// Not undoable.
// ---------------------------------------------------------------------------
import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import { ui } from "$lib/state/ui.svelte";

function makeAction(): ICommandAction {
  const current = viewport.video.currentFrame.value;
  const max = media.totalFrames;
  const localStorageFrameStep = localStorage.getItem("idah-video:settings:frame-step");
  const step = localStorageFrameStep ? Number(localStorageFrameStep) : ui.frameStep;
  return {
    command: { name: "viewport.skip_forward", group: "Viewport", modes: ["default", "review"], shortcut: null, shortDescription: "Skip forward", longDescription: "Jump forward by the configured number of frames" },
    do() {
      viewport.video.currentFrame.value = Math.min(current + step, max - 1);
    },
    isCombinable() { return false; },
    combine(prev: ICommandAction) { return prev; },
  };
}

export const command = {
  name: "viewport.skip_forward",
  group: "Viewport",
  modes: ["default", "review"] as string[],
  shortcut: "Shift+ArrowRight",
  shortDescription: "Skip forward",
  longDescription: "Jump forward by the configured number of frames",
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
