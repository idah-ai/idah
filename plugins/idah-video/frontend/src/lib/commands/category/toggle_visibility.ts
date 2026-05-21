// ---------------------------------------------------------------------------
// annotation.toggle_category_visibility
// Toggle visibility of annotations inside a category tree.
//
// Usage:
//   driver.command.call(
//     "annotation.toggle_category_visibility",
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
// Undoable: restores previous hidden states.
// ---------------------------------------------------------------------------

import type { IIdahDriverV2 } from "$idah/v2/types";
import { annotation } from "$lib/state/annotation.svelte";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.toggle_category_visibility",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface ToggleCategoryVisibilityProps {
  category: string;
  shapeType: string;
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
      const props = opts as unknown as ToggleCategoryVisibilityProps;

      if (!props || !data.annotations) {
        return noopAction(command);
      }

      let categoryAnnotations: AnnotationItem[];

      // Use provided annotations if available
      if (props.annotations && props.annotations.length > 0) {
        categoryAnnotations = props.annotations;
      } else if (props.category) {
        // Resolve annotations from category tree
        categoryAnnotations = data.annotations.items.filter(
          (ann) => isCategoryMatch(ann.value?.category, props.category) && ann.shape.type === props.shapeType,
        );
      } else {
        return noopAction(command);
      }

      if (categoryAnnotations.length === 0) {
        return noopAction(command);
      }

      // Snapshot IDs and their current hidden state from annotation module
      const snapshot = categoryAnnotations.map((ann) => ({
        id: ann.id,
        hidden: annotation.isHidden(ann),
      }));

      return {
        command: { ...command },

        async do() {
          if (!data.annotations) return;

          const anyHidden = snapshot.some((s) => s.hidden);
          const newHidden = !anyHidden;

          for (const { id } of snapshot) {
            annotation.toggleHidden(id, newHidden);
          }
        },

        async undo() {
          if (!data.annotations) return;

          // Restore original hidden states
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
