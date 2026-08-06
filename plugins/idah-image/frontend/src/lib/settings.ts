// ---------------------------------------------------------------------------
// settings.ts — Register image-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the sliders/options shown in the
// core topbar Settings menu. The values live here in the plugin's ui store
// (localStorage-backed, except opacity which is session-only); core only
// renders the controls and calls get/set.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "./state/ui.svelte";

export function registerSettings(driver: IIdahDriverV2): void {
  // NOTE: these descriptors are NOT type-checked here — the setting types are
  // kept only in core (not duplicated into this plugin). The canonical shape
  // (type/min/max/step/options/get/set) lives in core's plugin/v2/types.ts;
  // core validates and renders by `type`. See the note in $idah/v2/types.ts.
  driver.settings.register({
    collect: () => [
      {
        section: "idah-image",
        items: [
          {
            type: "slider",
            key: "image-opacity",
            label: "Image opacity",
            description: "Fade the image. Resets to 100 each time the plugin loads.",
            min: 0,
            max: 100,
            step: 1,
            get: () => ui.imageOpacity,
            set: (v) => (ui.imageOpacity = v),
          },
          {
            type: "slider",
            key: "annotation-opacity",
            label: "Annotation opacity",
            description: "Fade the fill of annotations (and mask overlays) — the border stroke stays fully visible. Resets to 100 each time the plugin loads.",
            min: 0,
            max: 100,
            step: 1,
            get: () => ui.annotationOpacity,
            set: (v) => (ui.annotationOpacity = v),
          },
          {
            type: "options",
            key: "render-mode",
            label: "Image Render Mode",
            description: "Switch between bilinear (smooth) and nearest-neighbor (pixelated) rendering for the image.",
            options: [
              { value: "bilinear", label: "Smooth" },
              { value: "nearest-neighbor", label: "Pixelated" },
            ],
            // Route through the command so the shortcut/palette and this menu
            // share one mutation path; the command fires settings.emitChange().
            get: () => ui.renderMode,
            set: (v) => driver.command.call("ui.toggle_render_mode", { value: v }),
          },
          {
            type: "options",
            key: "color-mode",
            label: "Annotation Color Mode",
            description: "Switch between category-based colors and random colors for annotations.",
            options: [
              { value: "category", label: "Category" },
              { value: "random", label: "Random" },
            ],
            get: () => ui.colorMode,
            set: (v) => driver.command.call("ui.toggle_color_mode", { value: v }),
          },
        ],
      },
    ],
  });
}
