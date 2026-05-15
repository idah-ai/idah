import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { getDriver } from "$lib/state/driver.svelte";

import type { IVideoAnnotationRecord } from "$lib/types";

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
  items: IVideoAnnotationRecord[],
): CategoryAction | null {
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => item.hidden);

  return {
    id: "visibility",
    label: isSomeHidden ? "Show category annotations" : "Hide category annotations",
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
  items: IVideoAnnotationRecord[],
): CategoryAction | null {
  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => item.locked);

  return {
    id: "editability",
    label: isSomeLocked ? "Unlock category annotations" : "Lock category annotations",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleCategoryEditability(categoryId);
    },
  };
}

export function getCategoryDeleteAction(
  items: IVideoAnnotationRecord[],
  onClickDelete: () => void,
): CategoryAction | null {
  if (items.length === 0) return null;

  return {
    id: "delete",
    label: "Delete category annotations",
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
  items: IVideoAnnotationRecord[];
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
