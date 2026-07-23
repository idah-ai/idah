// ---------------------------------------------------------------------------
// annotation.delete — Delete a specific annotation
// Undoable: restores the annotation.
//
// Usage:
//   driver.command.call("annotation.delete", {
//     annotationId: "some-id"
//   });
// ---------------------------------------------------------------------------
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { IMAGE_MASK } from "$lib/types";
import { invalidateAll } from "$lib/mask/tile-cache";

export const command = {
  name: "annotation.delete",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface AnnotationDeleteProps {
  annotationId: string;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as AnnotationDeleteProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props || !props.annotationId || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((a) => a.id === props.annotationId) as AnnotationItem;
      if (!record) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const sel = selection.value;
          if (sel && sel.id === props.annotationId) {
            selection.deselect();
          }

          // Free cached mask bitmaps if this is a mask annotation
          const shape = record.shape as Record<string, unknown> | undefined;
          if (shape?.type === IMAGE_MASK) {
            invalidateAll(props.annotationId);
          }

          await data.annotations!.delete(props.annotationId);
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
  });
}
