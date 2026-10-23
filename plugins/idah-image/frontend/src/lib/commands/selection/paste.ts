// ---------------------------------------------------------------------------
// idah-image:selection.paste — Paste copied annotations from clipboard
//
// Creates new annotations with the same shape data, category
// as the copied ones, but with new IDs.
// Pasted annotations are placed at the given cursor position (or, if absent,
// at the center of the viewport).
//
// Usage:
//   driver.command.call("selection.paste", { x: 0.5, y: 0.5 });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { clipboard } from "$lib/state/clipboard.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { uuidv7 } from "uuidv7";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "idah-image:selection.paste",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Control+V",
  shortDescription: "Paste copied annotations",
  longDescription: "Paste annotations from the clipboard at the cursor position",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      if (!isEditable()) return noopAction(command);

      if (!clipboard.hasData) return noopAction(command);

      const clipboardData = clipboard.annotations!;
      const centroid = clipboard.centroid;

      // Resolve the paste position ONCE at callback time (when the command is
      // first invoked by call()).  This ensures undo/redo always paste at the
      // same position, even if the cursor has moved.
      const capturePastePos: [number, number] = [
        (opts?.x as number | undefined) ?? viewport.cursor[0],
        (opts?.y as number | undefined) ?? viewport.cursor[1],
      ];

      // Pre-generate each entry's id ONCE here, outside do(). Redo reuses these
      // ids, so later actions on the redo stack (move, delete, update) still
      // refer to the same annotations.
      const plannedIds = clipboardData.map(() => uuidv7());

      // Records successfully created by the first do(). Redo restores exactly
      // these instead of creating new ones, because deletes are soft and
      // create() is a plain insert.
      const createdRecords: Array<Record<string, unknown>> = [];
      let hasRun = false;

      return {
        command: { ...command },
        async do() {
          // Redo: restore exactly the records created on the first run, reusing
          // their ids. Never re-create — the rows still exist (soft-deleted).
          if (hasRun) {
            for (const record of createdRecords) {
              await data.annotations!.restore(record as any);
            }
            if (createdRecords.length > 0) {
              selection.selectAnnotations(createdRecords.map((r) => r.id as string));
            }
            return;
          }

          // Use the captured position so undo/redo are deterministic regardless
          // of cursor position at redo time.
          const pastePos = capturePastePos;

          for (let i = 0; i < clipboardData.length; i++) {
            const entry = clipboardData[i];
            const newId = plannedIds[i];

            // Compute offset: shift ALL annotations by the same (pastePos - centroid).
            const dx = pastePos[0] - centroid[0];
            const dy = pastePos[1] - centroid[1];

            const rawPoints = (entry.shape_args?.points ?? []) as [number, number][];
            const newShapeArgs = {
              ...entry.shape_args,
              points:
                rawPoints.length > 0
                  ? rawPoints.map((p) => [p[0] + dx, p[1] + dy] as [number, number])
                  : entry.shape_args?.points,
            };

            const record = {
              id: newId,
              shape_type: entry.shape_type,
              shape_args: newShapeArgs,
              category: entry.category,
              properties: entry.properties ?? {},
              metadata: entry.metadata,
            };
            try {
              await data.annotations!.create(record as any);
              createdRecords.push(record);
            } catch (err) {
              console.error("Paste: failed to create annotation", err);
            }
          }

          // Select the newly created annotations
          if (createdRecords.length > 0) {
            selection.selectAnnotations(createdRecords.map((r) => r.id as string));
          }

          hasRun = true;
        },
        async undo() {
          // Remove the annotations created by this paste.
          if (data.annotations) {
            for (const record of createdRecords) {
              await data.annotations.delete(record.id as string);
            }
          }
          // Restore previous selection if the pasted set is no longer valid.
          if (selection.selectedAnnotations.every((a) => createdRecords.some((r) => r.id === a.id))) {
            selection.deselect();
          }
        },
        isCombinable() {
          return false;
        },
        combine(p: never) {
          return p;
        },
      };
    },
  });
}
