// ---------------------------------------------------------------------------
// annotation.toggleGroupVisibilitySolo — Toggle visibility solo for a group
// If the target group is the only visible group → show ALL groups
// Otherwise → hide ALL groups except the target one
//
// Usage:
//   driver.command.call("annotation.toggle_group_visibility_solo", {
//     groupId: "..."
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
  name: "annotation.toggle_group_visibility_solo",
  group: "Annotation",
  modes: ["default", "review"],
  shortcut: "Shift+H",
  shortDescription: "Solo toggle group visibility",
  longDescription: "If the group is the only visible group, show all groups; otherwise hide all groups except this one",
};

export interface GroupToggleVisibilitySoloProps {
  groupId: string;
}

/**
 * Get the effective group ID for an annotation: metadata.group_id takes
 * precedence; falling back to the annotation's own ID (a single‑annotation
 * group).
 */
function getEffectiveGroupId(ann: AnnotationItem): string {
  return (ann as any).metadata?.group_id || ann.id;
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
      let targetGroupId: string | undefined;

      if (opts) {
        // Programmatic call with options
        const props = opts as unknown as GroupToggleVisibilitySoloProps;
        if (props.groupId) {
          targetGroupId = props.groupId;
        }
      } else {
        // Keyboard shortcut: read from selection
        const sel = selection.value;
        if (sel && selection.isAnnotationGroup()) {
          targetGroupId = (sel as IAnnotationGroupSelection).groupId;
        } else if (sel && selection.isAnnotation()) {
          const annotation = (sel as IAnnotationSelection).annotation;
          targetGroupId = (annotation as any).metadata?.group_id || annotation.id;
        }
      }

      if (!targetGroupId || !data.annotations) return noopAction(command);

      const allAnnotations = data.annotations.items as AnnotationItem[];
      if (allAnnotations.length === 0) return noopAction(command);

      // Snapshot: group ID → { annotation ids, are they currently hidden? }
      const groupMap = new Map<string, { ids: string[]; hidden: boolean }>();

      for (const ann of allAnnotations) {
        const gid = getEffectiveGroupId(ann);
        if (!groupMap.has(gid)) {
          groupMap.set(gid, { ids: [], hidden: false });
        }
        groupMap.get(gid)!.ids.push(ann.id);
      }

      // Determine current visibility for each group:
      // a group is considered "visible" if NONE of its annotations are hidden
      for (const [gid, entry] of groupMap) {
        entry.hidden = entry.ids.some((id) => annotation.isHidden(id));
      }

      // Are any non-target groups currently visible?
      const hasNonTargetVisible = Array.from(groupMap.entries()).some(
        ([gid, entry]) => gid !== targetGroupId && !entry.hidden,
      );

      // If NO non-target group is visible → the target is the only visible
      // group → show ALL groups
      const showAll = !hasNonTargetVisible;

      // Build snapshot for undo: record every annotation's original hidden state
      const snapshot = allAnnotations.map((ann) => ({
        id: ann.id,
        hidden: annotation.isHidden(ann),
      }));

      // Collect all annotation IDs (flat list for the hide-all-except-target case)
      const targetGroupEntry = groupMap.get(targetGroupId);
      const targetIds = targetGroupEntry ? targetGroupEntry.ids : [];

      return {
        command: { ...command },

        async do() {
          if (!data.annotations) return;

          if (showAll) {
            // Show every annotation
            for (const { id } of snapshot) {
              annotation.toggleHidden(id, false);
            }
          } else {
            // Hide everything, then ensure the target group is visible
            for (const { id } of snapshot) {
              annotation.toggleHidden(id, true);
            }
            for (const id of targetIds) {
              annotation.toggleHidden(id, false);
            }
          }
        },

        async undo() {
          if (!data.annotations) return;
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
    activeWhen: () => selection.hasValidSelection(),
  });
}