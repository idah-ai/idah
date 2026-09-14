// ---------------------------------------------------------------------------
// idah-image:selection.batch-move — Move multiple selected shapes at once
// as a SINGLE undoable action (multi-shape drag).
//
// This command receives pre-captured snapshots (taken before any store
// mutation) so undo restores every annotation's original position in one
// Ctrl+Z, regardless of the anti-blink synchronous upsert that ran before
// this command was dispatched.
//
// Usage:
//   driver.command.call("idah-image:selection.batch-move", {
//     updates: [
//       {
//         annotationId: "...",
//         shape: { ... },          // new shape (moved position)
//         snapshot: { ... }        // pre-move annotation state
//       },
//       ...
//     ]
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IImageAnnotationShape } from "$lib/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "idah-image:selection.batch-move",
  group: "Selection",
  modes: ["editor"],
  shortcut: null,
  shortDescription: "Move multiple selected shapes",
  longDescription: null,
};

export interface BatchMoveProps {
  updates: Array<{
    annotationId: string;
    /** New shape with moved points. */
    shape: IImageAnnotationShape;
    /** Pre-move snapshot captured BEFORE the local store was mutated by the anti-blink upsert. */
    snapshot: AnnotationItem;
  }>;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as BatchMoveProps | undefined;
      if (!isEditable()) return noopAction(command);
      if (!props?.updates?.length || !data.annotations) return noopAction(command);

      const updates = props.updates.filter((u) => u?.snapshot);
      if (updates.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          // Apply every update — one shape write per annotation.
          for (const u of updates) {
            await data.annotations!.update({
              ...u.snapshot,
              shape: { ...u.shape },
            } as any);
          }
        },
        async undo() {
          if (!data.annotations) return;
          // Restore every snapshot — ALL shapes return to their pre-move
          // position in a single undo step.
          for (const u of updates) {
            await data.annotations.update(u.snapshot);
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
  });
}