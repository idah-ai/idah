// ---------------------------------------------------------------------------
// selection.delete — Delete whatever is currently selected
// Undoable: restores the annotation(s).
// Shortcut: Delete / Backspace
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { DEFAULT_MODE } from "$lib/types";

export const command = {
  name: "selection.delete",
  group: "Selection",
  modes: [DEFAULT_MODE],
  shortcut: "Backspace",
  shortDescription: "Delete selected",
  longDescription: null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      const sel = selection.value;
      if (!sel || !data.annotations) return noopAction(command);

      const record = sel as AnnotationItem;
      return {
        command: { ...command },
        async do() {
          selection.deselect();
          await data.annotations!.delete(record.id);
        },
        async undo() {
          if (!data.annotations) return;
          await data.annotations!.create({ ...record, id: record.id });
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
