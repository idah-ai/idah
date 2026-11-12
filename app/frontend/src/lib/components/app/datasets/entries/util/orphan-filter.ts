import type { Filters } from "@/data/filtering";

/** Clear user filters before enabling the orphan-category view. */
export function orphanFilterChanges(filters: Filters, checked: boolean): Filters {
  const cleared = Object.fromEntries(Object.keys(filters).map((key) => [key, undefined]));
  return { ...cleared, orphan_categories: checked ? true : undefined };
}
