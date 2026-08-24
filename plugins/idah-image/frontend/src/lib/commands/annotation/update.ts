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
  /** New category (optional — omit for shape-only edits like resize/rotate). */
  category?: string;
  /** New properties (optional — omit for shape-only edits like resize/rotate). */
  properties?: Record<string, unknown>;
  /** New shape type (optional — omit for value-only edits like category change). */
  shape_type?: string;
  /** New shape args (optional — omit for value-only edits like category change). */
  shape_args?: IImageAnnotationShape;
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

      const snapshot: AnnotationItem = {
        ...record,
        properties: { ...record.properties },
        shape_args: { ...(record.shape_args as IImageAnnotationShape) },
      };

      return {
        command: { ...command },
        async do() {
          // Start from the snapshot (full record including original shape and value),
          // then apply only the fields that the caller explicitly provided.
          const update: AnnotationItem = { ...snapshot };
          if (props.shape_args) {
            update.shape_args = props.shape_args as IImageAnnotationShape;
          }
          if (props.shape_type) {
            update.shape_type = props.shape_type;
          }
          if (props.category !== undefined) {
            update.category = props.category;
          }
          if (props.properties !== undefined) {
            update.properties = { ...props.properties };
          }
          // Strip tile keys from shape_args — they belong in annotation_shape,
          // not in the parent annotations.shape_args jsonb column
          if (update.shape_args) {
            update.shape_args = stripTileKeys(update.shape_args as Record<string, unknown>) as IImageAnnotationShape;
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
