import type { Icon as IconType } from "@lucide/svelte";

export interface BaseTabsItem<Value> {
  label: string;
  value: Value;
  icon?: typeof IconType;
  disabled?: boolean;
  visible?: boolean;
}

export type BaseTabs<Value> = BaseTabsItem<Value>[];
