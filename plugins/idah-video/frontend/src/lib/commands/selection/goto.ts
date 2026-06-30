// ---------------------------------------------------------------------------
// selection.goto — Jump to the first frame of the selected annotation
// Undoable: returns to the previous frame.
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

function hasAnnotationSelection(): boolean {
  return selection.value?.type === "annotation";
}

export const command = {
  name: "selection.goto",
  group: "Selection",
  modes: ["editor"],
  shortcut: null,
  shortDescription: "Go to selection",
  longDescription: "Jump to the first frame of the selected annotation",
};

let _previousFrame = 1;

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      const sel = selection.value;
      const previousFrame = viewport.video.currentFrame.value;

      return {
        command: { ...command },
        do() {
          if (sel?.type === "annotation") {
            const record = sel.annotation as any;
            const startFrame = record.shape?.start ?? 1;
            _previousFrame = previousFrame;
            viewport.video.goToFrame(startFrame);
          }
        },
        undo() {
          viewport.video.goToFrame(_previousFrame);
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: hasAnnotationSelection,
  });
}
