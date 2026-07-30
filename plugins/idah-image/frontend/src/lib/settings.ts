// ---------------------------------------------------------------------------
// settings.ts — Register image-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the opacity sliders shown in the
// core topbar Settings menu. The values live here in the plugin's ui store
// (localStorage-backed); core only renders the controls and calls get/set.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "./state/ui.svelte";

// TODO(remove-after-test): throwaway backing value for the mock "options"
// setting below — exercises the new segmented-control rendering with no effect.
let _mockOptionsChoice = "medium";

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
            set: (v) => (ui.imageOpacity = v),
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
            set: (v) => (ui.annotationOpacity = v),
          },
          // TODO(remove-after-test): mock "options" setting to exercise the
          // segmented-control rendering. No real action — backed by a throwaway
          // local var. Delete this item (and _mockOptionsChoice) once verified.
          {
            type: "options",
            key: "mock-options",
            label: "Mock options (test only)",
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
            default: "medium",
            get: () => _mockOptionsChoice,
            set: (v) => (_mockOptionsChoice = v),
          },
        ],
      },
    ],
  });
}
