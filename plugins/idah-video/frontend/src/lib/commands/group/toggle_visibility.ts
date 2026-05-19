// ---------------------------------------------------------------------------
// annotation.toggleGroupVisibility — Toggle visibility of a group of annotations
// Undoable: restores the previous hidden state.
//
// Usage:
//   driver.command.call("annotation.toggle_group_visibility", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_group_visibility",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface GroupToggleVisibilityProps {
  groupId: string;
  annotations?: AnnotationItem[];
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as GroupToggleVisibilityProps | undefined;

      if (!props || !data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      let groupAnnotations: AnnotationItem[];

      if (props.annotations && props.annotations.length > 0) {
        groupAnnotations = props.annotations;
      } else if (props.groupId) {
        groupAnnotations = data.annotations.items.filter(
          (ann) =>
            (ann as AnnotationItem).id === props.groupId ||
            (ann as AnnotationItem).metadata?.group_id === props.groupId,
        );
      } else {
        return noopAction(command);
      }

      if (groupAnnotations.length === 0) return noopAction(command);

      // Snapshot IDs and their current hidden state from the annotation module
      const snapshot = groupAnnotations.map((a) => ({
        id: a.id,
        hidden: annotation.isHidden(a.id),
      }));

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
