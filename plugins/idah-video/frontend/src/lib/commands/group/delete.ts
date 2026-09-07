// ---------------------------------------------------------------------------
// idah-video:annotation.group.delete — Delete an explicit list of annotations,
// or all annotations in a group.
// Undoable: restores all deleted annotations.
//
// This is the shared primitive for "delete this explicit list of annotations":
// pass `annotations` (optionally with a `groupId` for keyboard/palette context)
// and the list is deleted directly. When only `groupId` is given, the members
// are resolved from the data store by group id.
//
// Usage:
//   driver.command.call("idah-video:annotation.group.delete", {
//     annotations: [ ... ]            // delete exactly these
//   });
//   driver.command.call("idah-video:annotation.group.delete", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { selection } from "$lib/state/selection.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { annotation } from "$lib/state/annotation.svelte";

export const command = {
  name: "idah-video:annotation.group.delete",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface GroupDeleteProps {
  /** Group id used to resolve members when `annotations` is not provided. */
  groupId?: string;
  /** Explicit list of annotations to delete. When non-empty, `groupId` is ignored. */
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
      const props = opts as unknown as GroupDeleteProps | undefined;
      if (!isEditable()) return noopAction(command);
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
      // Locked groups must not be deletable — check member annotations so individually-locked annotations are also caught.
      if (groupAnnotations.some((ann) => annotation.isLocked(ann))) return noopAction(command);

      const snapshot = [...groupAnnotations];

      return {
        command: { ...command },
        async do() {
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
    activeWhen: () => selection.hasGroupSelection(),
  });
}
