// ---------------------------------------------------------------------------
// annotation.update — Update an annotation's value (category, attributes, …)
// Undoable: restores the previous value.
//
// Usage:
//   driver.command.call("annotation.update", { annotation, value });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import type { IImageAnnotationShape } from "$lib/types";
import { stripTileKeys } from "$lib/mask/strip-tile-keys";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "annotation.update",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Update annotation",
  longDescription: null,
};

export interface AnnotationUpdateProps {
  annotation: AnnotationItem;
  /** New value (optional — omit for shape-only edits like resize/rotate). */
  value?: Record<string, unknown>;
  /** New shape (optional — omit for value-only edits like category change). */
  shape?: IImageAnnotationShape;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as AnnotationUpdateProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === props.annotation.id);
      if (!record) return noopAction(command);

      const snapshot: AnnotationItem = { ...record, value: { ...record.value }, shape: { ...(record.shape as IImageAnnotationShape) } };

      return {
        command: { ...command },
        async do() {
          // Start from the snapshot (full record including original shape and value),
          // then apply only the fields that the caller explicitly provided.
          const update: AnnotationItem = { ...snapshot };
          if (props.shape) {
            update.shape = props.shape as IImageAnnotationShape;
          }
          if (props.value) {
            update.value = { ...(snapshot.value ?? {}), ...props.value };
          }
          // Strip tile keys from shape — they belong in annotation_shape,
          // not in the parent annotations.dimensions jsonb column
          if (update.shape) {
            update.shape = stripTileKeys(update.shape as Record<string, unknown>) as IImageAnnotationShape;
          }
          await data.annotations!.update(update);
        },
        async undo() {
          if (!data.annotations) return;
          await data.annotations.update(snapshot);
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
