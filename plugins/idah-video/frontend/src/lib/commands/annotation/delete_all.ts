// ---------------------------------------------------------------------------
// annotation.delete_all — Delete all annotations
// Undoable: restores all deleted annotations.
//
// Usage:
//   driver.command.call("annotation.delete_all");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { noopAction } from "..";
import { annotation } from "$lib/state/annotation.svelte";

export const command = {
  name: "annotation.delete_all",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Delete all annotations",
  longDescription: "Delete all annotations",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);
      if (!data.annotations) return noopAction(command);

      const snapshot: AnnotationItem[] = [...data.annotations.items];
      if (snapshot.length === 0) return noopAction(command);
      // Block delete-all entirely when any annotation belongs to a locked group — partial deletion is not allowed.
      if (snapshot.some((ann) => annotation.isLocked(ann))) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          if (!data.annotations) return;
          for (const ann of snapshot) {
            await data.annotations.delete(ann.id);
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const ann of snapshot) {
            await data.annotations.create({ ...ann });
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
