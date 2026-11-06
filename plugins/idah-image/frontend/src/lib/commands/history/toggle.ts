// ---------------------------------------------------------------------------
// history/toggle — Toggle the History panel.
// Shortcut: Y. Not undoable (like the sidebar-tab commands).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { history } from "$lib/state/history.svelte";
import {
  DEFAULT_MODE,
  REVIEW_MODE,
  NOTE_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_POLYGON,
  IMAGE_MASK,
} from "$lib/types";

export const command = {
  name: "idah-image:history.toggle",
  group: "UI",
  modes: [
    DEFAULT_MODE,
    REVIEW_MODE,
    NOTE_MODE,
    IMAGE_BOUNDING_BOX,
    IMAGE_CIRCLE,
    IMAGE_ELLIPSE,
    IMAGE_LINE,
    IMAGE_POLYGON,
    IMAGE_MASK,
  ],
  shortcut: "Y",
  shortDescription: "Toggle history",
  longDescription: "Open or close the annotation change history panel",
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
        history.toggle();
      },
      isCombinable() {
        return false;
      },
      combine(p) {
        return p;
      },
    }),
    group: command.group,
  });
}