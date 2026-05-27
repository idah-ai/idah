// ---------------------------------------------------------------------------
// annotation.toggle_category_visibility_solo
// Toggle visibility solo for a category tree.
// If the target category is the only visible category → show ALL annotations
// Otherwise → hide ALL annotations except those in the target category
//
// Usage:
//   driver.command.call("annotation.toggle_category_visibility_solo", {
//     category: "vehicle",
//   });
//
// Recursive matching:
//   vehicle
//     -> vehicle
//     -> vehicle/car
//     -> vehicle/car/honda
//
// Undoable: restores previous hidden states.
// ---------------------------------------------------------------------------

import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { isCategoryMatch } from "$lib/utils/category";

export const command = {
  name: "annotation.toggle_category_visibility_solo",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface ToggleCategoryVisibilitySoloProps {
  category: string;
  shapeType: string;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,

    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as ToggleCategoryVisibilitySoloProps;

      if (!props || !props.category || !data.annotations) {
        return noopAction(command);
      }

      const allAnnotations = data.annotations.items as AnnotationItem[];
      if (allAnnotations.length === 0) return noopAction(command);

      // Resolve annotations that belong to the target category
      let targetAnnotations = allAnnotations.filter((ann) => isCategoryMatch(ann.value?.category, props.category));

      // Further filter by shape type if provided
      if (props.shapeType) {
        targetAnnotations = targetAnnotations.filter((ann) => ann.shape.type === props.shapeType);
      }

      if (targetAnnotations.length === 0) {
        return noopAction(command);
      }

      // Determine if any non-target annotations are currently visible
      let nonTargetAnnotations = allAnnotations.filter((ann) => {
        if (props.shapeType) {
          // If shapeType is provided, only consider annotations of that shape type as non-target;
          // other shape types are ignored and treated as non-target
          return ann.shape.type !== props.shapeType || !isCategoryMatch(ann.value?.category, props.category);
        } else {
          // All annotations that don't match the category are non-target
          return !isCategoryMatch(ann.value?.category, props.category);
        }
      });

      const hasNonTargetVisible = nonTargetAnnotations.some((ann) => !annotation.isHidden(ann));

      // If NO non-target annotation is visible → the target is the only visible
      // category → show ALL annotations
      const showAll = !hasNonTargetVisible;

      // Snapshot all annotations for undo
      const snapshot = allAnnotations.map((ann) => ({
        id: ann.id,
        hidden: annotation.isHidden(ann),
      }));

      const targetIds = targetAnnotations.map((ann) => ann.id);

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
            // Hide everything, then ensure the target category annotations are visible
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
  });
}
