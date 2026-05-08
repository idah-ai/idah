// ---------------------------------------------------------------------------
// viewport.reset — Reset viewport zoom/pan to fit the video (non-undoable)
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.reset",
  group: "Viewport",
  modes: ["default", "review"],
  shortcut: null as string | null,
  shortDescription: "Reset view",
  longDescription: "Reset zoom and pan to fit the full video",
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
        viewport.workspace.transform.translate = [0, 0];
        viewport.workspace.transform.scale = 1.0;
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
