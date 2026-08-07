// ---------------------------------------------------------------------------
// toggle-render-mode — Switch between "bilinear" and "nearest-neighbor" video rendering
// Shortcut: None (available in the command palette)
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui, type RenderMode } from "$lib/state/ui.svelte";

export const command = {
  name: "ui.toggle_render_mode",
  group: "Display",
  modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
  shortcut: null,
  shortDescription: "Toggle video render mode",
  longDescription: "Switch between bilinear (smooth) and nearest-neighbor (pixelated) rendering for the video and placeholder",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    // opts.value sets an explicit mode (used by the settings menu); with no
    // opts it toggles (used by the shortcut/palette). Either way, notify the
    // settings channel so an open settings menu reflects the change.
    callback: (opts) => ({
      command: { ...command },
      do() {
        const value = opts?.value as RenderMode | undefined;
        ui.renderMode = value ?? ((ui.renderMode === "bilinear" ? "nearest-neighbor" : "bilinear") as RenderMode);
        driver.settings.emitChange();
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
