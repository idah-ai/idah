// ---------------------------------------------------------------------------
// annotation.toggle_group_editability — Toggle editability (lock) of a group of annotations
// Undoable: restores the previous locked state.
//
// Usage:
//   driver.command.call("annotation.toggle_group_editability", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_group_editability",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface GroupToggleEditabilityProps {
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
      const props = opts as unknown as GroupToggleEditabilityProps | undefined;

      if (!props || !data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      let groupAnnotations: AnnotationItem[];

      if (props.annotations && props.annotations.length > 0) {
        groupAnnotations = props.annotations;
      } else if (props.groupId) {
        groupAnnotations = data.annotations.items.filter((ann) => (ann as any).metadata?.group_id === props.groupId);

        // If filter is empty, also search for annotation with id === props.groupId
        if (groupAnnotations.length === 0) {
          const matchById = data.annotations.items.find((ann) => ann.id === props.groupId);
          if (matchById) {
            groupAnnotations = [matchById];
          }
        }
      } else {
        return noopAction(command);
      }

      if (groupAnnotations.length === 0) return noopAction(command);

      // Snapshot IDs and their current locked state from the annotation module
      const snapshot = groupAnnotations.map((a) => ({
        id: a.id,
        locked: annotation.isLocked(a.id),
      }));

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