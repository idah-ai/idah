// ---------------------------------------------------------------------------
// annotation.deleteGroup — Delete all annotations in a group
// Undoable: restores all annotations.
//
// Usage:
//   driver.command.call("annotation.deleteGroup", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { selection } from "$lib/state/selection.svelte";
import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";


export const command = {
  name: "annotation.delete_group",
  group: undefined,
  modes: ["default", "review"],
  shortcut: "Backspace",
  shortDescription: null,
  longDescription: null,
};

export interface GroupDeleteProps {
  groupId: string;
  annotations?: AnnotationItem[];
}

function hasGroupSelection(): boolean {
  return selection.value !== null && selection.value.type === "group";
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

      // Programmatic call with options
      if (opts) {
        const props = opts as unknown as GroupDeleteProps;
        if (props.groupId) {
          groupId = props.groupId;
        }
        if (props.annotations && props.annotations.length > 0) {
          groupAnnotations = props.annotations;
        }
      }

      // Keyboard shortcut: read from selection
      if (!groupId && !groupAnnotations && selection.value?.type === "group") {
        groupId = selection.value.groupId;
      }

      if (!data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      if (!groupAnnotations) {
        if (!groupId) return noopAction(command);

        groupAnnotations = data.annotations.items.filter(
          (ann) => (ann as any).metadata?.group_id === groupId
        );

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
          const confirmed = await showConfirmDialog({
            title: "Delete group",
            description: "Are you sure you want to delete all annotations in this group?",
          });

          if (!confirmed) return;

          selection.deselect();
          const deletions = snapshot.map((ann) => data.annotations!.delete(ann.id));
          await Promise.all(deletions);
        },
        async undo() {
          if (!data.annotations) return;
          const creations = snapshot.map((ann) => data.annotations!.create({ ...ann, id: ann.id }));
          await Promise.all(creations);
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
    activeWhen: hasGroupSelection,
  });
}
