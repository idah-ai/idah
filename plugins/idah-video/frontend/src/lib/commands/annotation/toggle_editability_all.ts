// ---------------------------------------------------------------------------
// annotation.toggle_editability_all — Toggle editability (lock) of all annotations
// Undoable: restores the previous locked state.
//
// Usage:
//   driver.command.call("annotation.toggle_editability_all");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_editability_all",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Toggle all annotations editability",
  longDescription: "Unlock all annotations if any are locked, otherwise lock all",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!data.annotations) return noopAction(command);

      const lockKeys = new Map<string, boolean>();
      for (const ann of data.annotations.items) {
        const key = ((ann as any)?.metadata?.group_id as string | undefined) ?? ann.id;
        if (!lockKeys.has(key)) {
          lockKeys.set(key, annotation.isLocked(key));
        }
      }
      const snapshot = Array.from(lockKeys.entries()).map(([id, locked]) => ({ id, locked }));
      if (snapshot.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const anyLocked = snapshot.some((s) => s.locked);
          const newLocked = !anyLocked;
          for (const { id } of snapshot) {
            annotation.toggleLocked(id, newLocked);
          }
        },
        async undo() {
          for (const { id, locked } of snapshot) {
            annotation.toggleLocked(id, locked);
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