// ---------------------------------------------------------------------------
// selection.delete — Delete whatever is currently selected
// Undoable: restores the annotation(s).
// Shortcut: Delete / Backspace
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { annotation } from "$lib/state/annotation.svelte";

export const command = {
  name: "selection.delete",
  group: "Selection",
  modes: ["default", "review"],
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
      if (!isEditable()) return noopAction(command);
      if (!sel || !data.annotations) return noopAction(command);

      if (sel.type === "annotation") {
        const record = sel.annotation as AnnotationItem;
        // Locked annotations (or those belonging to a locked group) must not be deletable.
        if (annotation.isLocked(record)) return noopAction(command);
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
          isCombinable() {
            return false;
          },
          combine(p) {
            return p;
          },
        };
      }

      // Resolve annotations for the group from the data store
      const groupId = (sel as any).groupId as string;
      const records = data.annotations.items.filter(
        (ann) => (ann as any).metadata?.group_id === groupId || ann.id === groupId,
      );
      if (records.length === 0) return noopAction(command);
      // Block group deletion if any member annotation belongs to a locked group.
      if (records.some((r) => annotation.isLocked(r))) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          selection.deselect();
          for (const r of records) {
            await data.annotations!.delete(r.id);
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const r of records) {
            await data.annotations!.create({ ...r, id: r.id });
          }
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
