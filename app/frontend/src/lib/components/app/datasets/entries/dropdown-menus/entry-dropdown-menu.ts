import { DownloadIcon, FlagIcon, Trash2Icon, UserRoundPlusIcon } from "@lucide/svelte";

import type { IDropdownMenuItem } from "@/components/app/dropdown-menus/types";

interface Params {
  onAssign: () => Promise<void> | void;
  onUnassign: () => Promise<void> | void;
  onSetPriority: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onExport?: () => Promise<void> | void;
  isAssigned?: boolean;
  isAssignDisabled?: boolean;
  isUnassignDisabled?: boolean;
  isExportHidden?: boolean;
}
export function getEntryDropdownMenuActions(params: Params): IDropdownMenuItem[] {
  const {
    onAssign,
    onUnassign,
    onSetPriority,
    onDelete,
    onExport,
    isAssigned,
    isAssignDisabled,
    isUnassignDisabled,
    isExportHidden,
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
      label: "Export",
      icon: DownloadIcon,
      action: onExport,
      hidden: isExportHidden,
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      destructive: true,
      action: onDelete,
    },
  ];
}
