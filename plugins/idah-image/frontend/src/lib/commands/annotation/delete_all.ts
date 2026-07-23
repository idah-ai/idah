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
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { recreateAnnotationWithTiles } from "$lib/mask/recreate-annotation";

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
            await recreateAnnotationWithTiles(data.annotations, ann);
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
