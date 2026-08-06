import { CircleQuestionMarkIcon, type LucideIcon } from "@lucide/svelte";
import type { BadgeVariant } from "$lib/components/ui/badge";

export interface BadgeConfig {
  label: string;
  variant: BadgeVariant;
  icon?: LucideIcon;
}

export function mapToBadge<T extends string, C extends BadgeConfig>(
  value: T,
  config: Partial<Record<T, C>>,
  fallback: C,
) {
  return config[value] ?? fallback;
}

export function arrayToBadgeMap<Value extends string, C extends BadgeConfig>(
  items: Array<{ value: Value } & C>,
): Record<Value, C> {
  return items.reduce(
    (map, { value, ...config }) => {
      map[value] = config as unknown as C;
      return map;
    },
    {} as Record<Value, C>,
  );
}

export const UNKNOWN_BADGE_CONFIG: BadgeConfig = {
  label: "Unknown",
  variant: "outline",
  icon: CircleQuestionMarkIcon,
};
