// ---------------------------------------------------------------------------
// idah-video:annotation.group.toggle-editability — Toggle editability (lock) of a group of annotations
// Undoable: restores the previous locked state.
//
// Usage:
//   driver.command.call("idah-video:annotation.group.toggle-editability", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { selection } from "$lib/state/selection.svelte";
import type { IAnnotationSelection, IAnnotationGroupSelection } from "$lib/state/selection.svelte";

export const command = {
  name: "idah-video:annotation.group.toggle-editability",
  group: "Annotation",
  modes: ["editor"],
  shortcut: "L",
  shortDescription: "Toggle editability",
  longDescription: "Toggle annotation's editability (lock/unlock)",
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
        const sel = selection.value;
        if (sel && selection.isAnnotationGroup()) {
          groupId = (sel as IAnnotationGroupSelection).groupId;
        } else if (sel && selection.isAnnotation()) {
          const annotation = (sel as IAnnotationSelection).annotation;
          // Use group_id from metadata if exists, otherwise use annotation's own id
          groupId = (annotation as any).metadata?.group_id || annotation.id;
        }
      }

      if (!data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      if (!groupAnnotations) {
        if (!groupId) return noopAction(command);

        groupAnnotations = data.annotations.items.filter(
          (ann) =>
            (ann as AnnotationItem).id === groupId ||
            (ann as AnnotationItem).metadata?.group_id === groupId,
        );
      }

      if (groupAnnotations.length === 0) return noopAction(command);

      // Determine the group ID from the first annotation's metadata or fall back to the first annotation's own id
      const resolvedGroupId: string =
        (groupAnnotations[0] as any)?.metadata?.group_id ?? groupId ?? groupAnnotations[0]?.id;

      // Snapshot includes the group ID and the group's overall locked status,
      // so that toggling uses the group-level key.
      const snapshot = {
        groupId: resolvedGroupId,
        locked: annotation.isLocked(resolvedGroupId),
        previousLocks: groupAnnotations.map((ann) => ({
          id: ann.id,
          locked: annotation.isLocked(ann),
        })),
      };

      return {
        command: { ...command },
        async do() {
          const newLocked = !snapshot.locked;
          annotation.toggleLocked(snapshot.groupId, newLocked);
        },
        async undo() {
          annotation.toggleLocked(snapshot.groupId, snapshot.locked);
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
    activeWhen: () => selection.hasValidSelection(),
  });
}
