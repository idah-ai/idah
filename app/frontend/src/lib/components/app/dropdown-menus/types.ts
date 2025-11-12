import { type Icon as IconType } from "@lucide/svelte";

export interface IDropdownMenuItem {
  label: string;
  icon?: typeof IconType;
  disabled?: boolean;
  hidden?: boolean;
  action?: () => Promise<void> | void;
}

export interface IDropdownMenus {
  [group: string]: {
    label?: string;
    items: IDropdownMenuItem[];
  };
}
