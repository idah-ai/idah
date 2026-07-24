// ---------------------------------------------------------------------------
// mask.toggle_mode — Toggle mask paint mode (add/remove)
// Not undoable (stateless).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_MASK } from "$lib/types";
import { maskSession } from "$lib/state/mask-session.svelte";

export const command = {
  name: "mask.toggle_mode",
  group: "Annotation",
  modes: [IMAGE_MASK],
  shortcut: "Z",
  shortDescription: "Toggle mask paint mode",
  longDescription: "Switch between adding and removing pixels with the mask brush.",
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
        maskSession.setMode(maskSession.mode === "add" ? "remove" : "add");
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
    group: command.group,
  });
}
