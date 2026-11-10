// ---------------------------------------------------------------------------
// idah-video:category.reuse-last — Reuse the category of the last annotation created.
//
// Clears the selection and picks that category for the next annotation, like
// clicking it in the sidebar. It never changes an existing annotation.
//
// Not undoable: picking a category is UI state.
//
// Usage:
//   driver.command.call("idah-video:category.reuse-last");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { categoryPicker } from "$lib/state/category-picker";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import { findLastCategory } from "$lib/utils/last-category";
import { NON_DRAWABLE_SHAPE_TYPES } from "$lib/types";
import { noopAction } from "..";

export const command = {
  name: "idah-video:category.reuse-last",
  group: "Annotation",
  modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
  shortcut: "R",
  shortDescription: "Reuse last category",
  longDescription: "Draw the next annotation with the category of the last annotation created",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);

      const last = findLastCategory(data.annotations?.items ?? [], NON_DRAWABLE_SHAPE_TYPES);
      if (!last) {
        showToast.info({ title: "No category to reuse", description: "Create an annotation first." });
        return noopAction(command);
      }

      selection.deselect();
      if (!categoryPicker.apply(last.category, last.shapeType)) {
        showToast.warning({
          title: "Category not available",
          description: `${last.category} is no longer in the label configuration.`,
        });
      }
      return noopAction(command);
    },
    group: command.group,
  });
}
