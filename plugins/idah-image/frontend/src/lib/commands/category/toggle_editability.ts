// ---------------------------------------------------------------------------
// annotation.toggle_category_editability
// Toggle editability (lock) of annotations inside a category tree.
//
// Usage:
//   driver.command.call(
//     "annotation.toggle_category_editability",
//     {
//       category: "vehicle",
//     },
//   );
//
// Recursive matching:
//   vehicle
//     -> vehicle
//     -> vehicle/car
//     -> vehicle/car/honda
//
// Undoable: restores previous locked states.
// ---------------------------------------------------------------------------

import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_category_editability",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface ToggleCategoryEditabilityProps {
  category: string;
  annotations?: AnnotationItem[];
}

function isCategoryMatch(annotationCategory: string | undefined, targetCategory: string): boolean {
  if (!annotationCategory) {
    return false;
  }

  return annotationCategory === targetCategory || annotationCategory.startsWith(`${targetCategory}/`);
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,

    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as ToggleCategoryEditabilityProps;

      if (!props || !data.annotations) {
        return noopAction(command);
      }

      let categoryAnnotations: AnnotationItem[];

      // Use provided annotations if available
      if (props.annotations && props.annotations.length > 0) {
        categoryAnnotations = props.annotations;
      } else if (props.category) {
        // Resolve from category tree
        categoryAnnotations = data.annotations.items.filter((ann) =>
          isCategoryMatch(ann.value?.category, props.category),
        );
      } else {
        return noopAction(command);
      }

      if (categoryAnnotations.length === 0) {
        return noopAction(command);
      }

      // Snapshot IDs and their current locked state from annotation module
      const snapshot = categoryAnnotations.map((ann) => ({
        id: ann.id,
        locked: annotation.isLocked(ann),
      }));

      return {
        command: { ...command },

        async do() {
          if (!data.annotations) return;

          const anyLocked = snapshot.some((s) => s.locked);
          const newLocked = !anyLocked;

          for (const { id } of snapshot) {
            annotation.toggleLocked(id, newLocked);
          }
        },

        async undo() {
          if (!data.annotations) return;

          // Restore original states
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