// ---------------------------------------------------------------------------
// viewport.zoom_out — Zoom out of the viewport
// Shortcut: Minus (-/_ key)
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport, VIEWPORT_MIN_ZOOM } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.zoom_out",
  group: "Viewport",
  modes: ["editor", "review"] as string[],
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
        viewport.workspace.transform.scale = Math.max(VIEWPORT_MIN_ZOOM, cur - 0.1);
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
