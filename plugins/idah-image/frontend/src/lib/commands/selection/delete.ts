// ---------------------------------------------------------------------------
// selection.delete — Delete whatever is currently selected
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
      if (!isEditable() || viewport.isReviewWorkspace) return noopAction(command);
      const sel = selection.value;
      if (!sel || !data.annotations) return noopAction(command);

      const record = sel as AnnotationItem;
      return {
        command: { ...command },
        async do() {
          selection.deselect();
          // Free cached mask bitmaps if this is a mask annotation
          const shape = record.shape as Record<string, unknown> | undefined;
          if (shape?.type === IMAGE_MASK) {
            invalidateAll(record.id);
          }
          await data.annotations!.delete(record.id);
        },
        async undo() {
          if (!data.annotations) return;
          // Recreate the annotation first, without tile data in dimensions
          const { shape: _shape, ...rest } = record;
          const tileKeys = _shape ? Object.keys(_shape).filter((k) => k.startsWith("tile-")) : [];
          const cleanShape = _shape ? { ..._shape } : {};
          for (const k of tileKeys) delete cleanShape[k];
          await data.annotations!.create({ ...rest, id: record.id, shape: cleanShape });
          // Restore tiles via setShape/setShapes so they land in annotation_shape, not dimensions
          const entries: Array<{ key: string; value: object | null }> = [];
          for (const k of tileKeys) {
            const val = (_shape as Record<string, unknown>)[k] as { rle?: string } | undefined;
            if (val?.rle) {
              entries.push({ key: k, value: { rle: val.rle } });
            }
          }
          if (entries.length > 1) {
            await data.annotations!.setShapes(record.id, entries);
          } else if (entries.length === 1) {
            await data.annotations!.setShape(record.id, entries[0].key, entries[0].value);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
