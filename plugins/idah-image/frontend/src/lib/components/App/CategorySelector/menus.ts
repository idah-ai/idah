import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";

import type { IImageAnnotationRecord } from "$lib/types";

export interface CategoryAction {
  id: string;
  label: string;
  icon: typeof IconType;
  destructive?: boolean;
  alwaysShow?: boolean;
  onClick: (e: MouseEvent) => void;
}

export function toggleCategoryVisibility(categoryId: string) {
  getDriver().command.call("annotation.toggle_category_visibility", {
    category: categoryId,
  });
}

export function toggleCategoryEditability(categoryId: string) {
  getDriver().command.call("annotation.toggle_category_editability", {
    category: categoryId,
  });
}

export function deleteCategoryAnnotations(categoryId: string) {
  getDriver().command.call("annotation.delete_category", {
    category: categoryId,
  });
}

export function getCategoryVisibilityAction(
  categoryId: string,
  items: IImageAnnotationRecord[],
): CategoryAction | null {
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => annotation.isHidden(item));

  return {
    id: "visibility",
    label: "Show/Hide this category annotations",
    icon: isSomeHidden ? EyeOffIcon : EyeIcon,
    alwaysShow: isSomeHidden,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleCategoryVisibility(categoryId);
    },
  };
}

export function getCategoryEditabilityAction(
  categoryId: string,
  items: IImageAnnotationRecord[],
): CategoryAction | null {
  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => annotation.isLocked(item));

  return {
    id: "editability",
    label: "Lock/Unlock this category annotations",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleCategoryEditability(categoryId);
    },
  };
}

export function getCategoryDeleteAction(
  items: IImageAnnotationRecord[],
  onClickDelete: () => void,
): CategoryAction | null {
  if (items.length === 0) return null;

  return {
    id: "delete",
    label: "Delete this category annotations",
    icon: Trash2Icon,
    destructive: true,
    onClick: async (e: MouseEvent) => {
      e.stopPropagation();
      onClickDelete();
    },
  };
}

export function getCategoryActions(props: {
  categoryId: string;
  items: IImageAnnotationRecord[];
  onClickDelete: () => void;
}): CategoryAction[] {
  const { categoryId, items, onClickDelete } = props;

  const actions = [
    getCategoryVisibilityAction(categoryId, items),
    getCategoryEditabilityAction(categoryId, items),
    getCategoryDeleteAction(items, onClickDelete),
  ];

  return actions.filter(Boolean) as CategoryAction[];
}
