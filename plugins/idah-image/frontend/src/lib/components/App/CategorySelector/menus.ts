import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { isEditable } from "$lib/state/editor.svelte";

import type { IImageAnnotationRecord } from "$lib/types";
import { viewport } from "$lib/state/viewport.svelte";

export interface CategoryAction {
  id: string;
  label: string;
  icon: typeof IconType;
  destructive?: boolean;
  disabled?: boolean;
  alwaysShow?: boolean;
  onClick: (e: MouseEvent) => void;
}

export function toggleCategoryVisibility(opts: { categoryId: string; shapeType: string }, e?: MouseEvent) {
  const { categoryId, shapeType } = opts;

  getDriver().command.call("annotation.toggle_category_visibility", {
    category: categoryId,
    shapeType,
  });
}

export function toggleCategoryEditability(opts: { categoryId: string; shapeType: string }) {
  const { categoryId, shapeType } = opts;

  getDriver().command.call("annotation.toggle_category_editability", {
    category: categoryId,
    shapeType,
  });
}

export function deleteCategoryAnnotations(opts: { categoryId: string; shapeType: string }) {
  const { categoryId, shapeType } = opts;

  getDriver().command.call("annotation.delete_category", { category: categoryId, shapeType });
}

export function getCategoryVisibilityAction(opts: {
  categoryId: string;
  items: IImageAnnotationRecord[];
  shapeType: string;
}): CategoryAction | null {
  const { categoryId, items, shapeType } = opts;
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => annotation.isHidden(item));

  return {
    id: "visibility",
    label: "Show/Hide category annotations",
    icon: isSomeHidden ? EyeOffIcon : EyeIcon,
    alwaysShow: isSomeHidden,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleCategoryVisibility({ categoryId, shapeType }, e);
    },
  };
}

export function getCategoryEditabilityAction(opts: {
  categoryId: string;
  items: IImageAnnotationRecord[];
  shapeType: string;
}): CategoryAction | null {
  const { categoryId, items, shapeType } = opts;

  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => annotation.isLocked(item));

  return {
    id: "editability",
    label: "Lock/Unlock category annotations",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleCategoryEditability({ categoryId, shapeType });
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
    label: "Delete category annotations",
    icon: Trash2Icon,
    destructive: true,
    disabled: !isEditable() || viewport.isReviewWorkspace || items.some((item) => annotation.isLocked(item)),
    onClick: async (e: MouseEvent) => {
      e.stopPropagation();
      onClickDelete();
    },
  };
}

export function getCategoryActions(props: {
  categoryId: string;
  shapeType: string;
  items: IImageAnnotationRecord[];
  onClickDelete: () => void;
}): CategoryAction[] {
  const { categoryId, items, shapeType, onClickDelete } = props;

  const actions = [
    getCategoryVisibilityAction({ categoryId, items, shapeType }),
    getCategoryEditabilityAction({ categoryId, items, shapeType }),
    getCategoryDeleteAction(items, onClickDelete),
  ];

  return actions.filter(Boolean) as CategoryAction[];
}
