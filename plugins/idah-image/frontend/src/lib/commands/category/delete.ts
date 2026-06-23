// ---------------------------------------------------------------------------
// annotation.delete_category
// Delete all annotations inside a category tree.
//
// Usage:
//   driver.command.call(
//     "annotation.delete_category",
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
// Undoable: restores deleted annotations.
// ---------------------------------------------------------------------------

import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { isCategoryMatch } from "$lib/utils/category";
import { noopAction } from "..";

import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";

export const command = {
  name: "annotation.delete_category",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface DeleteCategoryProps {
  category: string;
  shapeType: string;
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
      const props = opts as unknown as DeleteCategoryProps;

      if (!isEditable()) return noopAction(command);
      if (!props || !data.annotations) return noopAction(command);

      let categoryAnnotations: AnnotationItem[];

      // Use provided annotations if available
      if (props.annotations && props.annotations.length > 0) {
        categoryAnnotations = props.annotations;
      } else if (props.category || props.shapeType) {
        categoryAnnotations = data.annotations.items;

        if (props.category) {
          categoryAnnotations = categoryAnnotations.filter((ann) =>
            isCategoryMatch(ann.value?.category, props.category),
          );
        }

        if (props.shapeType) {
          categoryAnnotations = categoryAnnotations.filter((ann) => ann.shape.type === props.shapeType);
        }
      } else {
        return noopAction(command);
      }

      if (categoryAnnotations.length === 0) {
        return noopAction(command);
      }
      // Block category deletion if any annotation in the category belongs to a locked group.
      if (categoryAnnotations.some((ann) => annotation.isLocked(ann))) return noopAction(command);

      const snapshot = [...categoryAnnotations];

      return {
        command: { ...command },

        async do() {
          if (!data.annotations) return;

          for (const ann of snapshot) {
            await data.annotations!.delete(ann.id);
          }
        },

        async undo() {
          if (!data.annotations) return;

          // Restore deleted annotations
          for (const ann of snapshot) {
            await data.annotations!.create({
              ...ann,
              id: ann.id,
            });
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
