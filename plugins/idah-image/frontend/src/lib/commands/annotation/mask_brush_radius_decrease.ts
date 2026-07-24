// ---------------------------------------------------------------------------
// mask.brush_radius_decrease — Decrease mask brush radius
// Shortcut: - (only in mask brush mode)
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { IMAGE_MASK } from "$lib/types";
import { maskTool } from "$lib/state/mask-tool.svelte";

export const command = {
  name: "mask.brush_radius_decrease",
  group: "Annotation",
  modes: [IMAGE_MASK],
  shortcut: "BracketLeft",
  shortDescription: "Decrease brush radius",
  longDescription: "Decrease the mask brush radius by 5 pixels.",
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
      do() { maskTool.brushRadius = Math.max(0, maskTool.brushRadius - 1); },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
