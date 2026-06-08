// ---------------------------------------------------------------------------
// viewport.zoom_out — Zoom out of the viewport
// Shortcut: Minus (-/_ key)
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";

import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.zoom_out",
  group: "Viewport",
  modes: ["default", "review"] as string[],
  shortcut: "Minus",
  shortDescription: "Zoom out",
  longDescription: "Zoom out of the viewport",
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
        const cur = viewport.workspace.transform.scale;
        const minScale = viewport.workspace.getMinScale();
        viewport.workspace.transform.scale = Math.max(minScale, cur - 0.1);
      },
      isCombinable() {
        return false;
      },
      combine(prev) {
        return prev;
      },
    }),
    group: command.group,
  });
}
