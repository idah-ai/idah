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
import { selection, type IAnnotationSelection } from "$lib/state/selection.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { viewport } from "$lib/state/viewport.svelte";

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
      // Locked annotations (or those belonging to a locked group) must not be deletable.
      if (annotation.isLocked(record)) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const sel = selection.value as IAnnotationSelection;
          if (selection.isAnnotation() && sel.annotation.id === props.annotationId) {
            selection.deselect();
          }

          await data.annotations!.delete(props.annotationId);
          // Seek to the annotation's start frame
          const deletedFrame = (record.shape as any)?.start;
          if (deletedFrame !== undefined) viewport.video.currentFrame.value = deletedFrame;
        },
        async undo() {
          if (!data.annotations) return;
          await data.annotations!.create({ ...record, id: record.id });
          // Seek to the annotation's start frame
          const restoredFrame = (record.shape as any)?.start;
          if (restoredFrame !== undefined) viewport.video.currentFrame.value = restoredFrame;
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
  });
}
