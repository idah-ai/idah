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
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { selection } from "$lib/state/selection.svelte";

export const command = {
  name: "annotation.toggle_group_editability",
  group: "Annotation",
  modes: ["default", "review"],
  shortcut: "L",
  shortDescription: "Toggle editability",
  longDescription: "Toggle annotation's editability (lock/unlock)",
};

export interface GroupToggleEditabilityProps {
  groupId: string;
  annotations?: AnnotationItem[];
}

function hasValidSelection(): boolean {
  return selection.value !== null && 
    (selection.value.type === "group" || selection.value.type === "annotation");
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      // Determine groupId from props (programmatic call) or selection (keyboard shortcut)
      let groupId: string | undefined;
      let groupAnnotations: AnnotationItem[] | undefined;

      if (opts) {
        // Programmatic call with options
        const props = opts as unknown as GroupToggleEditabilityProps;
        if (props.groupId) {
          groupId = props.groupId;
        }
        if (props.annotations && props.annotations.length > 0) {
          groupAnnotations = props.annotations;
        }
      } else {
        // Keyboard shortcut: read from selection
        if (selection.value) {
          if (selection.value.type === "group") {
            groupId = selection.value.groupId;
          } else if (selection.value.type === "annotation") {
            const annotation = selection.value.annotation;
            // Use group_id from metadata if exists, otherwise use annotation's own id
            groupId = (annotation as any).metadata?.group_id || annotation.id;
          }
        }
      }

      if (!data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      if (!groupAnnotations) {
        if (!groupId) return noopAction(command);

        groupAnnotations = data.annotations.items.filter((ann) => (ann as any).metadata?.group_id === groupId);

        // If filter is empty, also search for annotation with id === groupId
        if (groupAnnotations.length === 0) {
          const matchById = data.annotations.items.find((ann) => ann.id === groupId);
          if (matchById) {
            groupAnnotations = [matchById];
          }
        }
      }

      if (groupAnnotations.length === 0) return noopAction(command);

      const snapshot = [...groupAnnotations];

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
    activeWhen: hasValidSelection,
  });
}
