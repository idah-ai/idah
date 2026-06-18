// ---------------------------------------------------------------------------
// viewport.zoom_in — Zoom into the viewport
// Shortcut: Equal (+/= key)
// Not undoable.
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.zoom_in",
  group: "Viewport",
  modes: ["editor", "review"] as string[],
  shortcut: "Equal",
  shortDescription: "Zoom in",
  longDescription: "Zoom into the viewport",
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
        viewport.workspace.transform.scale = Math.min(100, cur + 0.1);
      },
      isCombinable() { return false; },
      combine(prev) { return prev; },
    }),
    group: command.group,
  });
}
