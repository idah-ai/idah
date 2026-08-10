// ---------------------------------------------------------------------------
// settings.ts — Register image-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the controls shown in the core
// topbar Settings menu. The values live here in the plugin's ui store; core
// only renders the controls and calls get/set. Note the ui store has two
// tiers — these particular settings are session-only, not localStorage-backed.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { LabelVisibility } from "./state/ui.svelte";
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
            min: 0,
            max: 100,
            step: 1,
            default: 100,
            get: () => ui.imageOpacity,
            set: (v: number) => (ui.imageOpacity = v),
          },
          {
            type: "slider",
            key: "annotation-opacity",
            label: "Annotation opacity",
            min: 0,
            max: 100,
            step: 1,
            default: 100,
            get: () => ui.annotationOpacity,
            set: (v: number) => (ui.annotationOpacity = v),
          },
          // Category label visibility. Defaults to "never" so a dense canvas
          // stays uncluttered until the user opts in.
          {
            type: "options",
            key: "label-visibility",
            label: "Category label",
            options: [
              { value: "always", label: "On" },
              { value: "hover", label: "On hover" },
              { value: "never", label: "Off" },
            ],
            default: "never",
            get: () => ui.labelVisibility,
            set: (v: string) => (ui.labelVisibility = v as LabelVisibility),
          },
        ],
      },
    ],
  });
}
