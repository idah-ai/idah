import { type Icon as IconType } from "@lucide/svelte";

export type DropdownMenuContentAlignment = "start" | "center" | "end";
export type DropdownMenuContentSide = "top" | "right" | "bottom" | "left";

export interface IDropdownMenuItem {
  label: string;
  icon?: typeof IconType;
  disabled?: boolean;
  hidden?: boolean;
  action?: () => Promise<void> | void;
  items?: {
    [group: string]: {
      label?: string;
      items: IDropdownMenuItem[];
    };
  };
}

export interface IDropdownMenus {
  [group: string]: {
    label?: string;
    items: IDropdownMenuItem[];
  };
}
