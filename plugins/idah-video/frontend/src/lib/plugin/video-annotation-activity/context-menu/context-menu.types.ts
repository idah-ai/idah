import { type Icon as IconType } from "@lucide/svelte";

export interface Menu {
  label: string;
  icon?: typeof IconType;
  hidden?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

export interface Menus {
  [group: string]: {
    label?: string;
    items: {
      [name: string]: Menu;
    };
  };
}
