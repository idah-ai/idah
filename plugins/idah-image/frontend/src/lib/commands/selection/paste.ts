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

      // Shared between do() and undo() — tracks the IDs created by this paste.
      const createdIds: string[] = [];

      return {
        command: { ...command },
        async do() {
          // Paste position: explicit option (context menu), else last cursor,
          // else viewport center.
          const targetX = (opts?.x as number | undefined) ?? viewport.cursor[0];
          const targetY = (opts?.y as number | undefined) ?? viewport.cursor[1];
          const pastePos: [number, number] = [targetX, targetY];


          for (const entry of clipboardData) {

            const newId = uuidv7();

            // Compute offset: shift ALL annotations by the same (pastePos - centroid).
            const dx = pastePos[0] - centroid[0];
            const dy = pastePos[1] - centroid[1];

            const rawPoints = (entry.shape?.points ?? []) as [number, number][];
            const newShape = {
              ...entry.shape,
              points: rawPoints.length > 0
                ? rawPoints.map((p) => [p[0] + dx, p[1] + dy] as [number, number])
                : entry.shape?.points,
            };

            try {
              await data.annotations!.create({
                id: newId,
                shape: newShape,
                value: entry.value ?? {},
                metadata: entry.metadata,
              } as any);
              createdIds.push(newId);
            } catch (err) {
              console.error("Paste: failed to create annotation", err);
            }
          }

          // Select the newly created annotations
          if (createdIds.length > 0) {
            selection.selectAnnotations(createdIds);
          }
        },
        async undo() {
          // Remove the annotations created by this paste.
          if (data.annotations) {
            for (const id of createdIds) {
              await data.annotations.delete(id);
            }
          }
          // Restore previous selection if the pasted set is no longer valid.
          if (selection.selectedAnnotations.every((a) => createdIds.includes(a.id))) {
            selection.deselect();
          }
        },
        isCombinable() { return false; },
        combine(p: never) { return p; },
      };
    },
  });
}
