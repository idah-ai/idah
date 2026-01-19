import { DownloadIcon, FlagIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

import type { IDropdownMenuItem } from "@/components/app/dropdown-menus/types";

interface Params {
  onAssign: () => Promise<void> | void;
  onSetPriority: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onExport: () => Promise<void> | void;
}
export function getEntryDropdownMenuActions(params: Params): IDropdownMenuItem[] {
  const { onAssign, onSetPriority, onDelete, onExport } = params;

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
      label: "Export",
      icon: DownloadIcon,
      action: onExport,
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      action: onDelete,
    },
  ];
}
