// ---------------------------------------------------------------------------
// idah-image:category.reuse-last — Reuse the category of the last annotation created.
//
// Clears the selection and picks the category of the annotation the user
// created last in this dataset (see recent-category.ts) for the next one, like
// clicking it in the sidebar. It never changes an existing annotation.
//
// Not undoable: picking a category is UI state.
//
// Usage:
//   driver.command.call("idah-image:category.reuse-last");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { selection } from "$lib/state/selection.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { categoryPicker } from "$lib/state/category-picker";
import { recentCategory } from "$lib/state/recent-category";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import {
  DEFAULT_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_MASK,
  IMAGE_POLYGON,
} from "$lib/types";
import { noopAction } from "..";

export const command = {
  name: "idah-image:category.reuse-last",
  group: "Annotation",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK],
  shortcut: "R",
  shortDescription: "Reuse last category",
  longDescription: "Draw the next annotation with the category of the last annotation you created",
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

      const last = recentCategory.get(driver);
      if (!last) {
        showToast.info({ title: "No category to reuse", description: "Draw an annotation first." });
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
