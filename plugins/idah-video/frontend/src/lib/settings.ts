// ---------------------------------------------------------------------------
// settings.ts — Register video-specific settings with the V2 driver
//
// Called once on init(driver). Contributes the opacity sliders shown in the
// core topbar Settings menu. The values live here in the plugin's ui store
// (localStorage-backed); core only renders the controls and calls get/set.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "./state/ui.svelte";

export function registerSettings(driver: IIdahDriverV2): void {
  driver.settings.register({
    collect: () => [
      {
        section: "idah-video",
        items: [
          {
            key: "video-opacity",
            label: "Video opacity",
            min: 0,
            max: 100,
            step: 1,
            default: 100,
            get: () => ui.videoOpacity,
            set: (v) => (ui.videoOpacity = v),
          },
          {
            key: "annotation-opacity",
            label: "Annotation opacity",
            min: 0,
            max: 100,
            step: 1,
            default: 100,
            get: () => ui.annotationOpacity,
            set: (v) => (ui.annotationOpacity = v),
          },
        ],
      },
    ],
  });
}
