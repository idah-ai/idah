// ---------------------------------------------------------------------------
// toggle-render-mode — Switch between "bilinear" and "nearest-neighbor" video rendering
// Shortcut: None (available in the command palette)
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui, type RenderMode } from "$lib/state/ui.svelte";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, NOTE_MODE, REVIEW_MODE } from "$lib/types";

export const command = {
  name: "ui.toggle_render_mode",
  group: "Display",
  modes: [DEFAULT_MODE, REVIEW_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, NOTE_MODE],
  shortcut: null,
  shortDescription: "Toggle image render mode",
  longDescription:
    "Switch between bilinear (smooth) and nearest-neighbor (pixelated) rendering for the image and placeholder",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    // opts.value sets an explicit mode (settings menu); no opts toggles (shortcut).
    callback: (opts) => ({
      command: { ...command },
      do() {
        const value = opts?.value as RenderMode | undefined;
        ui.renderMode = value ?? ((ui.renderMode === "bilinear" ? "nearest-neighbor" : "bilinear") as RenderMode);
        driver.settings.emitChange();
      },
      isCombinable() {
        return false;
      },
      combine(p) {
        return p;
      },
    }),
    group: command.group,
  });
}
