// ---------------------------------------------------------------------------
// viewport.reset — Reset viewport zoom/pan to fit the video (non-undoable)
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.reset",
  modes: ["default", "review"],
  shortcut: null as [string | null, string] | null,
  shortDescription: "Reset view",
  longDescription: "Reset zoom and pan to fit the full video",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    () => ({
      command: { ...command },
      do() {
        viewport.workspace.transform.translate = [0, 0];
        viewport.workspace.transform.scale = 1.0;
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
  );
}
