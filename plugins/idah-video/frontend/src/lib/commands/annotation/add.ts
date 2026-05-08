// ---------------------------------------------------------------------------
// annotation.add — Create a new annotation (bounding box or polygon)
// Undoable: deletes the created annotation.
//
// Accepts a full shape (IVideoAnnotationShape) with the correct type,
// so the caller determines whether it's a bounding-box or polygon.
//
// Usage:
//   driver.command.call("annotation.add", {
//     shape: { type: "idah-video:bounding-box", start: 1, end: 100, frames: [...] },
//     value: { category: "car" }
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$idah/v2/video-types";
import { noopAction } from "..";

export const command = {
  name: "annotation.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null as string | null,
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
            metadata: {
              id: "", // will be replaced by the store-generated id
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {},
            },
          });
          // Set the group id to the annotation's own id so it renders as its own track
          (this as any)._createdId = created.id;
          // Exit drawing mode after successful creation
          driver.setMode("default");
        },
        async undo() {
          const id = (this as any)._createdId;
          if (id && data.annotations) {
            await data.annotations.delete(id);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
