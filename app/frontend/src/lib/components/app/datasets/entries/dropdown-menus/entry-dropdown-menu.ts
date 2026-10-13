import { FlagIcon, RotateCcwIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

import type { IDropdownMenuItem } from "@/components/app/dropdown-menus/types";

interface Params {
  onAssign: () => Promise<void> | void;
  onUnassign: () => Promise<void> | void;
  onSetPriority: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onReopen?: () => Promise<void> | void;
  isAssigned?: boolean;
  isAssignDisabled?: boolean;
  isUnassignDisabled?: boolean;
  isReopenHidden?: boolean;
  isReopenDisabled?: boolean;
}
export function getEntryDropdownMenuActions(params: Params): IDropdownMenuItem[] {
  const {
    onAssign,
    onUnassign,
    onSetPriority,
    onDelete,
    onReopen,
    isAssigned,
    isAssignDisabled,
    isUnassignDisabled,
    isReopenHidden,
    isReopenDisabled,
  } = params;

  return [
    {
      label: "Assign to",
      icon: UserRoundPlusIcon,
      action: onAssign,
      disabled: isAssignDisabled,
    },
    {
      label: "Unassign",
      icon: UserRoundPlusIcon,
      action: onUnassign,
      hidden: !isAssigned,
      disabled: isUnassignDisabled,
    },
    {
      label: "Set Priority",
      icon: FlagIcon,
      action: onSetPriority,
    },
    {
      label: "Reopen",
      icon: RotateCcwIcon,
      action: onReopen,
      hidden: isReopenHidden,
      disabled: isReopenDisabled,
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      destructive: true,
      action: onDelete,
    },
  ];
}
