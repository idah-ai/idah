import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon, type Icon as IconType } from "@lucide/svelte";

import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { selection } from "$lib/state/selection.svelte";

import type { IImageAnnotationRecord } from "$lib/types";

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

export function toggleVisibility(groupId: string) {
  getDriver().command.call("annotation.toggle_group_visibility", { groupId });
}

export function toggleEditability(groupId: string) {
  getDriver().command.call("annotation.toggle_group_editability", { groupId });
}

export function getVisibilityAction(groupId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeHidden = items.some((item) => annotation.isHidden(item));

  return {
    id: "visibility",
    label: "Show/Hide annotation",
    icon: isSomeHidden ? EyeOffIcon : EyeIcon,
    alwaysShow: isSomeHidden,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleVisibility(groupId);
    },
  };
}

export function getEditabilityAction(groupId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  const isSomeLocked = items.some((item) => annotation.isLocked(item));

  return {
    id: "editability",
    label: "Lock/Unlock annotation",
    icon: isSomeLocked ? LockIcon : LockOpenIcon,
    alwaysShow: isSomeLocked,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      toggleEditability(groupId);
    },
  };
}

export function getDeleteAction(groupId: string, items: IImageAnnotationRecord[]): AnnotationAction | null {
  if (items.length === 0) return null;

  return {
    id: "delete",
    label: "Delete annotation",
    icon: Trash2Icon,
    destructive: true,
    disabled: items.some((item) => annotation.isLocked(item)),
    onClick: () => {
      showConfirmDialog({
        title: "Delete annotation",
        description: "Are you sure you want to delete this annotation?",
        onConfirm: () => {
          selection.selectGroup(groupId);
          getDriver().command.call("selection.delete", {
            groupId,
            annotations: items,
          });
        },
      });
    },
  };
}

export function getAnnotationActions(props: { items: IImageAnnotationRecord[]; groupId: string }): AnnotationAction[] {
  const { items, groupId } = props;

  const actions = [
    getVisibilityAction(groupId, items),
    getEditabilityAction(groupId, items),
    getDeleteAction(groupId, items),
  ];

  return actions.filter(Boolean) as AnnotationAction[];
}
