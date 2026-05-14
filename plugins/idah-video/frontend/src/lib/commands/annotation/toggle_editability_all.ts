// ---------------------------------------------------------------------------
// annotation.toggle_editability_all — Toggle editability (lock) of all annotations
// Undoable: restores the previous locked state.
//
// Usage:
//   driver.command.call("annotation.toggle_editability_all");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
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

      const snapshot: AnnotationItem[] = [...data.annotations.items];
      if (snapshot.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          if (!data.annotations) return;
          // If any annotation is locked, unlock all; otherwise lock all
          const anyLocked = snapshot.some((a) => a.locked);
          const newLocked = !anyLocked;
          for (const ann of snapshot) {
            await data.annotations!.update({ ...ann, locked: newLocked });
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const ann of snapshot) {
            await data.annotations!.update({ ...ann, locked: ann.locked });
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
