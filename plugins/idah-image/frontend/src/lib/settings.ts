// ---------------------------------------------------------------------------
// settings.ts — Register image-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the sliders/options shown in the
// core topbar Settings menu. The values live here in the plugin's ui store
// (session-only for filters, localStorage-persisted for some options); core
// only renders the controls and calls get/set.
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
          // ── Image ───────────────────────────────────────────────────
          {
            type: "slider",
            key: "image-opacity",
            label: "Opacity",
            description: "Fade the image. Resets to 100 each time the plugin loads.",
            subSection: "Image",
            default: 100,
            min: 0,
            max: 100,
            step: 1,
            get: () => ui.imageOpacity,
            set: (v: number) => (ui.imageOpacity = v),
          },
          {
            type: "slider",
            key: "image-contrast",
            label: "Contrast",
            description:
              "Adjust the image contrast. 0 is normal; -100 is fully gray; +100 is double the contrast. Resets to 0 each time the plugin loads.",
            subSection: "Image",
            default: 0,
            min: -100,
            max: 100,
            step: 1,
            get: () => ui.imageContrast,
            set: (v: number) => (ui.imageContrast = v),
          },
          {
            type: "slider",
            key: "image-brightness",
            label: "Brightness",
            description:
              "Adjust the image brightness. 0 is normal; -100 is fully black; +100 is double the brightness. Resets to 0 each time the plugin loads.",
            subSection: "Image",
            default: 0,
            min: -100,
            max: 100,
            step: 1,
            get: () => ui.imageBrightness,
            set: (v: number) => (ui.imageBrightness = v),
          },
          {
            type: "slider",
            key: "image-saturation",
            label: "Saturation",
            description:
              "Adjust the color saturation. 0 is normal; -100 is grayscale; +100 is double the saturation. Resets to 0 each time the plugin loads.",
            subSection: "Image",
            default: 0,
            min: -100,
            max: 100,
            step: 1,
            get: () => ui.imageSaturation,
            set: (v: number) => (ui.imageSaturation = v),
          },
          {
            type: "slider",
            key: "image-gamma",
            label: "Gamma",
            description:
            "Adjust the image gamma correction. 0 is normal; negative values brighten shadows; positive values deepen shadows. Resets to 0 each time the plugin loads.",
            subSection: "Image",
            default: 0,
            min: -100,
            max: 100,
            step: 1,
            get: () => ui.imageGamma,
            set: (v: number) => (ui.imageGamma = v),
          },
          {
            type: "slider",
            key: "image-hue",
            label: "Hue",
            description:
              "Rotate the image hue. 0 is normal; -100 shifts hues -180°; +100 shifts hues +180°. Resets to 0 each time the plugin loads.",
            subSection: "Image",
            default: 0,
            min: -100,
            max: 100,
            step: 1,
            get: () => ui.imageHue,
            set: (v: number) => (ui.imageHue = v),
          },
          {
            type: "options",
            key: "render-mode",
            label: "Render Mode",
            description: "Switch between bilinear (smooth) and nearest-neighbor (pixelated) rendering for the image.",
            subSection: "Image",
            options: [
              { value: "bilinear", label: "Smooth" },
              { value: "nearest-neighbor", label: "Pixelated" },
            ],
            get: () => ui.renderMode,
            set: (v: string) => driver.command.call("idah-image:ui.toggle-render-mode", { value: v }),
          },
          // ── Grid ──────────────────────────────────────────────────────
          {
            type: "switch",
            key: "grid-enabled",
            label: "Show grid",
            subSection: "Grid",
            subSectionHeader: true,
            default: false,
            get: () => ui.gridEnabled,
            set: (v: boolean) => (ui.gridEnabled = v),
          },
          {
            type: "slider",
            key: "grid-size",
            label: "Size",
            description: "Grid cell size in pixels. Anchored to the media so it scales with zoom.",
            subSection: "Grid",
            default: 100,
            min: 5,
            max: 1000,
            step: 5,
            disabled: () => !ui.gridEnabled,
            get: () => ui.gridSize,
            set: (v: number) => (ui.gridSize = v),
          },
          {
            type: "slider",
            key: "grid-opacity",
            label: "Opacity",
            description: "Grid line opacity.",
            subSection: "Grid",
            default: 100,
            min: 0,
            max: 100,
            step: 1,
            disabled: () => !ui.gridEnabled,
            get: () => ui.gridOpacity,
            set: (v: number) => (ui.gridOpacity = v),
          },
          // ── Annotations ──────────────────────────────────────────────
          {
            type: "slider",
            key: "annotation-opacity",
            label: "Opacity",
            description:
              "Fade the fill of annotations (and mask overlays) — the border stroke stays fully visible. Resets to 100 each time the plugin loads.",
            subSection: "Annotations",
            min: 0,
            max: 100,
            step: 1,
            get: () => ui.annotationOpacity,
            set: (v: number) => (ui.annotationOpacity = v),
          },
          {
            type: "options",
            key: "color-mode",
            label: "Color Mode",
            description: "Switch between category-based colors and random colors for annotations.",
            subSection: "Annotations",
            options: [
              { value: "category", label: "Category" },
              { value: "random", label: "Random" },
            ],
            get: () => ui.colorMode,
            set: (v: string) => driver.command.call("idah-image:ui.toggle-color-mode", { value: v }),
          },
          {
            type: "options",
            key: "label-visibility",
            label: "Category Label",
            description:
              "Show each annotation's category name on the canvas — always, only while hovered or selected, or never. Saved to your account.",
            subSection: "Annotations",
            options: [
              { value: "always", label: "On" },
              { value: "hover", label: "On hover" },
              { value: "never", label: "Off" },
            ],
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
  const v = driver.accountSettings.get<LabelVisibility>(CATEGORY_LABEL_VISIBILITY_KEY);
  if (v === "always" || v === "hover" || v === "never") {
    ui.labelVisibility = v;
  }
}
