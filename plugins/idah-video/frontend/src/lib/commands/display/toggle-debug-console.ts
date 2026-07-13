// ---------------------------------------------------------------------------
// toggle-debug-console — Toggle the debug overlay
// Shortcut: Ctrl+`
// Not undoable.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { ui } from "$lib/state/ui.svelte";

export const command = {
  name: "debug.toggle_console",
  group: "Display",
  modes: ["*"],
  shortcut: "Control+Shift+Backquote",
  shortDescription: "Toggle debug console",
  longDescription: "Show/hide the debug information overlay",
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
      do() {
        ui.toggleDebugConsole();
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
