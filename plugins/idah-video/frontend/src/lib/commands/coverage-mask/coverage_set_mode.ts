// ---------------------------------------------------------------------------
// coverage-mask/coverage_set_mode — Set coverage mask mode (add/remove/off)
//
// Called by the core toolbar button via driver.command.call("coverage-mask-set-mode", ...)
// to switch the coverage mask between add, remove, and off states across the
// plugin bundle boundary.
// ---------------------------------------------------------------------------
import { ui } from "$lib/state/ui.svelte";
import { viewport, EDITOR_MODE, REVIEW_MODE } from "$lib/state/viewport.svelte";

import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "coverage-mask-set-mode",
  group: "Coverage Mask",
  modes: [EDITOR_MODE, REVIEW_MODE] as string[],
  shortcut: null as string | null,
  shortDescription: "Set coverage mask mode (add/remove/off)",
  longDescription: null as string | null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts) => {
      const { mode } = opts ?? {};
      return {
        command: { ...command },
        do() {
          if (mode === "off") {
            ui.coverageMaskActive = false;
            if (viewport.isCoverageMaskMode) viewport.mode = EDITOR_MODE;
          } else if (mode === "add") {
            ui.coverageMaskActive = true;
            ui.coverageMaskIsRemove = false;
            ui.coverageMaskToolType = "bbox";
            viewport.mode = "idah-video:coverage-mask-bbox";
          } else if (mode === "remove") {
            ui.coverageMaskActive = true;
            ui.coverageMaskIsRemove = true;
            viewport.mode = "idah-video:coverage-mask-bbox";
          }
          driver.settings.invalidate();
          driver.toolbar.invalidate();
        },
        isCombinable() {
          return false;
        },
        combine(prev) {
          return prev;
        },
      };
    },
    group: command.group,
  });
}