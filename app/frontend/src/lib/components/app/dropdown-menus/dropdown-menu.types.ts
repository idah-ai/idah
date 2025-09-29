import { type Icon as IconType } from "@lucide/svelte";

export interface DropdownMenuItemBaseProps {
  label: string;
  icon?: typeof IconType;
  disabled?: boolean;
  action?: () => Promise<void> | void;
}
