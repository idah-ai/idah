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
import { VIDEO_POLYGON, type IVideoAnnotationShape } from "$lib/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { draft as polygonDraft } from "./polygon.add_point.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { uuidv7 } from "uuidv7";

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
      if (!isEditable()) return noopAction(command);
      if (!props || !data.annotations) return noopAction(command);

      const createdId = uuidv7();

      return {
        command: { ...command },
        async do() {
          const created = await data.annotations!.create({
            id: createdId,
            shape: props.shape,
            value: props.value,
          });
          // Select the newly created annotation
          selection.selectAnnotation(created as any);
          // Seek to the frame the annotation was created on
          const firstFrame = (props.shape as any).frames?.[0];
          if (firstFrame) viewport.video.currentFrame.value = firstFrame.frame;
          driver.command.call("timeline.scroll_to_annotation");
          // Exit drawing mode after successful creation
          driver.setMode("editor");
        },
        async undo() {
          if (data.annotations) {
            await data.annotations.delete(createdId);
          }
          // Restore draft and mode for multi-step shapes
          if (props.shape.type === VIDEO_POLYGON) {
            const firstFrame = (props.shape as any).frames?.[0];
            if (firstFrame?.points?.length) {
              viewport.video.currentFrame.value = firstFrame.frame;
              polygonDraft.points = firstFrame.points;
            }
            driver.setMode(VIDEO_POLYGON);
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
