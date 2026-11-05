// ---------------------------------------------------------------------------
// idah-image:category.reuse-last — Reuse the category of the last annotation created.
//
// Nothing selected, or the selection already has that category (typically the
// annotation just drawn): picks it for the next annotation, like clicking it in
// the sidebar. A selection with another category: changes it to that category.
//
// Not undoable itself: picking a category is UI state, and changing the selection
// goes through idah-image:annotation.update, which is.
//
// Usage:
//   driver.command.call("idah-image:category.reuse-last");
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { categoryPicker } from "$lib/state/category-picker";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import { findLastCategory, planCategoryReuse } from "$lib/utils/last-category";
import {
  DEFAULT_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_MASK,
  IMAGE_POLYGON,
  NON_DRAWABLE_SHAPE_TYPES,
} from "$lib/types";
import { noopAction } from "..";

export const command = {
  name: "idah-image:category.reuse-last",
  group: "Annotation",
  modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK],
  shortcut: "R",
  shortDescription: "Reuse last category",
  longDescription:
    "Use the category of the last annotation created: pick it for the next annotation, or change the selected annotation to it",
};

function categoryLabel(driver: IIdahDriverV2, category: string, shapeType: string): string {
  return driver.config[shapeType]?.values.find((v) => v.id === category)?.label ?? category;
}

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
      const selected = selection.value;
      const plan = planCategoryReuse(last, selected?.category, selected !== null);
      if (plan.action === "none") {
        showToast.info({ title: "No category to reuse", description: "Create an annotation first." });
        return noopAction(command);
      }

      if (plan.action === "draw") selection.deselect();
      if (!categoryPicker.apply(plan.category, plan.shapeType)) {
        showToast.warning({
          title: "Category not available",
          description: `${categoryLabel(driver, plan.category, plan.shapeType)} can't be used for the selected annotation.`,
        });
      }
      return noopAction(command);
    },
    group: command.group,
  });
}
