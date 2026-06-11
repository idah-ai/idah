// ---------------------------------------------------------------------------
// annotation.toggle_visibility_all — Toggle visibility of all annotations
// Undoable: restores the previous hidden state.
//
// Usage:
//   driver.command.call("annotation.toggle_visibility_all");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_visibility_all",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Toggle all annotations visibility",
  longDescription: "Show all annotations if any are hidden, otherwise hide all",
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

      const snapshot: { id: string; hidden: boolean }[] = data.annotations.items.map((ann) => ({
        id: ann.id,
        hidden: annotation.isHidden(ann),
      }));
      if (snapshot.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const anyHidden = snapshot.some((s) => s.hidden);
          const newHidden = !anyHidden;
          for (const { id } of snapshot) {
            annotation.toggleHidden(id, newHidden);
          }
        },
        async undo() {
          for (const { id, hidden } of snapshot) {
            annotation.toggleHidden(id, hidden);
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