import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";

import type { IImageAnnotationRecord } from "$lib/types";
import { viewport } from "$lib/state/viewport.svelte";

export interface AnnotationAction {
  id: string;
  label: string;
  icon: typeof IconType;
  destructive?: boolean;
  alwaysShow?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  onClick: (e: MouseEvent) => void;
}

export function getVisibilityAction(annotationId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => annotation.isHidden(item));

  return {
    id: "visibility",
    label: "Show/Hide annotation",
    icon: isSomeHidden ? EyeOffIcon : EyeIcon,
    alwaysShow: isSomeHidden,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      const newHidden = !isSomeHidden;
      for (const item of items) {
        if (annotation.isHidden(item) !== newHidden) {
          annotation.toggleHidden(item.id, newHidden);
        }
      }
    },
  };
}

export function getEditabilityAction(annotationId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => annotation.isLocked(item));

  return {
    id: "editability",
    label: "Lock/Unlock annotation",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      const newLocked = !isSomeLocked;
      for (const item of items) {
        if (annotation.isLocked(item) !== newLocked) {
          annotation.toggleLocked(item.id, newLocked);
        }
      }
    },
  };
}

export function getDeleteAction(annotationId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  return {
    id: "delete",
    label: "Delete annotation",
    icon: Trash2Icon,
    destructive: true,
    disabled: viewport.isReviewWorkspace || items.some((item) => annotation.isLocked(item)),
    onClick: () => {
      showConfirmDialog({
        title: "Delete annotation",
        description: "Are you sure you want to delete this annotation?",
        onConfirm: () => {
          getDriver().command.call("annotation.delete", { annotationId });
        },
      });
    },
  };
}

export function getAnnotationActions(props: {
  items: IImageAnnotationRecord[];
  annotationId: string;
}): AnnotationAction[] {
  const { items, annotationId } = props;

  const actions = [
    getVisibilityAction(annotationId, items),
    getEditabilityAction(annotationId, items),
    getDeleteAction(annotationId, items),
  ];

  return actions.filter(Boolean) as AnnotationAction[];
}
