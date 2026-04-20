import { FlagIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

import type { IDropdownMenuItem } from "@/components/app/dropdown-menus/types";

interface Params {
  onAssign: () => Promise<void> | void;
  onUnassign: () => Promise<void> | void;
  onSetPriority: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  isAssigned?: boolean;
}
export function getEntryDropdownMenuActions(params: Params): IDropdownMenuItem[] {
  const { onAssign, onUnassign, onSetPriority, onDelete, isAssigned } = params;

  return [
    {
      label: "Assign to",
      icon: UserRoundPlusIcon,
      action: onAssign,
    },
    {
      label: "Unassign",
      icon: UserRoundPlusIcon,
      action: onUnassign,
      hidden: !isAssigned,
    },
    {
      label: "Set Priority",
      icon: FlagIcon,
      action: onSetPriority,
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      action: onDelete,
    },
  ];
}
