import { FlagIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

import type { DropdownMenuItemBaseProps } from "@/components/app/dropdown-menu/dropdown-menu.types";

interface Params {
  onAssign: () => Promise<void> | void;
  onSetPriority: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}
export function getEntryDropdownMenuActions(params: Params): DropdownMenuItemBaseProps[] {
  const { onAssign, onSetPriority, onDelete } = params;

  return [
    {
      label: "Assign to",
      icon: UserRoundPlusIcon,
      action: onAssign,
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
