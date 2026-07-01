// ---------------------------------------------------------------------------
// annotation.add — Create a new annotation (bounding box or polygon)
// Undoable: deletes the created annotation.
//
// Usage:
//   driver.command.call("annotation.add", {
//     shape: { type: "idah-image:bounding-box", start: 1, end: 100, frames: [...] },
//     value: { category: "car" }
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { DEFAULT_MODE, IMAGE_POLYGON, IMAGE_LINE, type IImageAnnotationShape } from "$lib/types";
import { noopAction } from "..";
import { uuidv7 } from "uuidv7";
import { draft as polygonDraft } from "./polygon.add_point.svelte";
import { lineDraft } from "./line.add_point.svelte";

export const command = {
  name: "annotation.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface AnnotationAddProps {
  shape: IImageAnnotationShape;
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

      // Generate the ID once per command action so redo recreates the same
      // annotation instead of generating a new ID. Follow-up actions in the
      // undo/redo stack can then keep targeting this annotation safely.
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
          // Exit drawing mode after successful creation
          driver.setMode(DEFAULT_MODE);
        },
        async undo() {
          if (data.annotations) {
            await data.annotations.delete(createdId);
          }
          // Restore drawing mode for multi-step shapes so the user can
          // continue editing or individually undo add_point commands.
          // For line, restore the first point so the preview is visible.
          if (props.shape.type === IMAGE_POLYGON) {
            driver.setMode(IMAGE_POLYGON);
            polygonDraft.points = props.shape.points
          } else if (props.shape.type === IMAGE_LINE) {
            driver.setMode(IMAGE_LINE);
            lineDraft.points = props.shape.points.slice(0, 1);
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
