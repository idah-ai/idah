// ---------------------------------------------------------------------------
// annotation.add — Create a new annotation (bounding box or polygon)
// Undoable: deletes the created annotation.
//
// Usage:
//   driver.command.call("annotation.add", {
//     shape: { type: "idah-video:bounding-box", start: 1, end: 100, frames: [...] },
//     value: { category: "car" }
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$lib/types";
import { noopAction } from "..";

export const command = {
  name: "annotation.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface AnnotationAddProps {
  shape: IVideoAnnotationShape;
  value?: { category?: string; label?: string; [key: string]: unknown };
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as AnnotationAddProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const created = await data.annotations!.create({
            shape: props.shape,
            value: props.value,
          });
          (this as any)._createdId = created.id;
          // Select the newly created annotation
          selection.selectAnnotation(created as any);
          driver.command.call("timeline.scroll_to_annotation");
          // Exit drawing mode after successful creation
          driver.setMode("editor");
        },
        async undo() {
          const id = (this as any)._createdId;
          if (id && data.annotations) {
            await data.annotations.delete(id);
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
  });
}
