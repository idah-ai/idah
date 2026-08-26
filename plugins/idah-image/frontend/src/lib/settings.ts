// ---------------------------------------------------------------------------
// settings.ts — Register image-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the sliders/options shown in the
// core topbar Settings menu. The values live here in the plugin's ui store
// (localStorage-backed, except opacity and label visibility which are
// session-only); core only renders the controls and calls get/set.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { LabelVisibility } from "./state/ui.svelte";
import { ui } from "./state/ui.svelte";

// Account-settings key for the persisted category label visibility.
const CATEGORY_LABEL_VISIBILITY_KEY = "annotation:category.label-visibility";

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
            set: (v: number) => (ui.imageOpacity = v),
          },
          {
            type: "slider",
            key: "annotation-opacity",
            label: "Annotation opacity",
            description:
              "Fade the fill of annotations (and mask overlays) — the border stroke stays fully visible. Resets to 100 each time the plugin loads.",
            min: 0,
            max: 100,
            step: 1,
            get: () => ui.annotationOpacity,
            set: (v: number) => (ui.annotationOpacity = v),
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
            // share one mutation path; the command fires settings.invalidate().
            get: () => ui.renderMode,
            set: (v: string) => driver.command.call("ui.toggle_render_mode", { value: v }),
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
            set: (v: string) => driver.command.call("ui.toggle_color_mode", { value: v }),
          },
          {
            type: "options",
            key: "label-visibility",
            label: "Category label",
            description:
              "Show each annotation's category name on the canvas — always, only while hovered or selected, or never. Saved to your account.",
            options: [
              { value: "always", label: "On" },
              { value: "hover", label: "On hover" },
              { value: "never", label: "Off" },
            ],
            // Set directly rather than through a command: unlike render/color
            // mode this has no shortcut or palette entry, so the popover is the
            // only mutation path and core emits the change itself after set().
            // Persist in the active plugin namespace; hydrateSettings() seeds it on init.
            get: () => ui.labelVisibility,
            set: (v: string) => {
              ui.labelVisibility = v as LabelVisibility;
              void driver.accountSettings.upsert(CATEGORY_LABEL_VISIBILITY_KEY, v);
            },
          },
        ],
      },
    ],
  });
}

// Seed ui.labelVisibility from the persisted account setting. Called once from
// init(), after core has awaited accountSettings.load(), so the value is present.
// Plugin and core live in separate Svelte runtimes, so this is a one-time read
// rather than a reactive subscription.
export function hydrateSettings(driver: IIdahDriverV2): void {
  const v = driver.accountSettings.get(CATEGORY_LABEL_VISIBILITY_KEY);
  if (v === "always" || v === "hover" || v === "never") {
    ui.labelVisibility = v;
  }
}
