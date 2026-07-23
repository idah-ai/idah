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
import { DEFAULT_MODE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK, type IImageAnnotationShape } from "$lib/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { uuidv7 } from "uuidv7";
import { draft as polygonDraft } from "./polygon.add_point.svelte";
import { lineDraft } from "./line.add_point.svelte";
import { maskSession } from "$lib/state/mask-session.svelte";
import { flushDirtyTiles } from "$lib/mask/flush-tiles";
import { invalidateAll } from "$lib/mask/tile-cache";

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
  /** Optional pre-generated ID. If omitted, one is generated. */
  id?: string;
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

      const createdId = props.id ?? uuidv7();

      // Capture the session's painted tiles NOW, not inside do(). do() runs
      // again on redo against the same action object, but maskSession.reset()
      // clears the live session after the first run — a live read inside do()
      // would see nothing on redo. Cloning here means every do() call, first
      // run or any later redo, replays the exact same originally-painted tiles.
      const maskBufferSnapshot = new Map<string, Uint8Array>();
      if (props.shape.type === IMAGE_MASK) {
        for (const tileKey of maskSession.getDirtyTiles()) {
          const [colStr, rowStr] = tileKey.split(":");
          const buf = maskSession.getTileBuffer(parseInt(colStr, 10), parseInt(rowStr, 10));
          if (buf) maskBufferSnapshot.set(tileKey, buf.slice()); // clone — never alias the live buffer
        }
      }
      const dirtyTileKeys = [...maskBufferSnapshot.keys()];

      return {
        command: { ...command },
        async do() {
          const created = await data.annotations!.create({
            id: createdId,
            shape: props.shape,
            value: props.value,
          });
          selection.selectAnnotation(created as any);

          if (props.shape.type === IMAGE_MASK && dirtyTileKeys.length > 0) {
            await flushDirtyTiles(
              createdId,
              dirtyTileKeys,
              (col, row) => maskBufferSnapshot.get(`${col}:${row}`),
              (annId, key, value) => data.annotations!.setShape(annId, key, value),
              (annId, entries) => data.annotations!.setShapes(annId, entries),
            );
            maskSession.reset();
          }

          if (props.shape.type !== IMAGE_MASK) {
            driver.setMode(DEFAULT_MODE);
          }
        },
        async undo() {
          if (data.annotations) {
            // Free cached mask bitmaps before the annotation is deleted
            if (props.shape.type === IMAGE_MASK) {
              invalidateAll(createdId);
            }
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
