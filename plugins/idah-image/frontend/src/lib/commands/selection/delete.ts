// ---------------------------------------------------------------------------
// idah-image:selection.delete — Delete whatever is currently selected
// Undoable: restores the annotation(s).
// Shortcut: Delete / Backspace
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { DEFAULT_MODE, IMAGE_MASK } from "$lib/types";
import { viewport } from "$lib/state/viewport.svelte";
import { invalidateAll } from "$lib/mask/tile-cache";
import { recreateAnnotationWithTiles } from "$lib/mask/recreate-annotation";

export const command = {
  name: "idah-image:selection.delete",
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
      if (!isEditable() || viewport.isReviewWorkspace) return noopAction(command);
      const selected = selection.selectedAnnotations;
      if (selected.length === 0 || !data.annotations) return noopAction(command);

      const records = selected as AnnotationItem[];
      const ids = records.map((r) => r.id);
      return {
        command: { ...command },
        async do() {
          selection.deselect();
          // Free cached mask bitmaps if any are mask annotations
          for (const record of records) {
            const shape = record.shape as Record<string, unknown> | undefined;
            if (shape?.type === IMAGE_MASK) {
              invalidateAll(record.id);
            }
          }
          // Delete all selected annotations
          await Promise.all(ids.map((id) => data.annotations!.delete(id)));
        },
        async undo() {
          if (!data.annotations) return;
          await Promise.all(records.map((record) => recreateAnnotationWithTiles(data.annotations!, record)));
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
