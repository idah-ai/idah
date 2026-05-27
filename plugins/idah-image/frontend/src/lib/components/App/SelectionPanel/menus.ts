import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";

import type { IImageAnnotationRecord } from "$lib/types";

export interface AnnotationAction {
  id: string;
  label: string;
  icon: typeof IconType;
  destructive?: boolean;
  alwaysShow?: boolean;
  onClick: (e: MouseEvent) => void;
}

export function toggleVisibility() {
  getDriver().command.call("annotation.toggle_group_visibility");
}

export function toggleEditability() {
  getDriver().command.call("annotation.toggle_category_editability");
}

export function deleteAnnotation(annotationId: string) {
  getDriver().command.call("annotation.delete", { annotationId });
}

export function getVisibilityAction(items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => annotation.isHidden(item));

  return {
    id: "visibility",
    label: "Show/Hide annotation",
    icon: isSomeHidden ? EyeOffIcon : EyeIcon,
    alwaysShow: isSomeHidden,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleVisibility();
    },
  };
}

export function getEditabilityAction(items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => annotation.isLocked(item));

  return {
    id: "editability",
    label: "Lock/Unlock annotation",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleEditability();
    },
  };
}

export function getDeleteAction(items: IImageAnnotationRecord[], onClickDelete: () => void): AnnotationAction | null {
  if (items.length === 0) return null;

  return {
    id: "delete",
    label: "Delete annotation",
    icon: Trash2Icon,
    destructive: true,
    onClick: async (e: MouseEvent) => {
      e.stopPropagation();
      onClickDelete();
    },
  };
}

export function getAnnotationActions(props: {
  items: IImageAnnotationRecord[];
  onClickDelete: () => void;
}): AnnotationAction[] {
  const { items, onClickDelete } = props;

  const actions = [getVisibilityAction(items), getEditabilityAction(items), getDeleteAction(items, onClickDelete)];

  return actions.filter(Boolean) as AnnotationAction[];
}
