import type { TablePreferences } from "@/components/app/datasource-table/types";
import type { Filters } from "@/data/filtering";

export const entryTabs = ["All", "Open", "Completed"] as const;
export type EntryTab = (typeof entryTabs)[number];

export function entryTabFilters(tab: EntryTab): Filters {
  if (tab === "Completed") return { status__in: ["completed"] };
  if (tab === "Open") return { status__in: ["pending", "in_progress"], wf_step__in: ["annotate", "review"] };
  return {};
}

function sameValues(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && expected.every((item) => value.includes(item));
}

export function entryTab(filters: Filters): EntryTab | null {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return null;
  const keys = Object.keys(filters);
  return (
    entryTabs.find((tab) => {
      const canonical = entryTabFilters(tab);
      return (
        keys.length === Object.keys(canonical).length &&
        Object.entries(canonical).every(([key, values]) => sameValues(filters[key], values))
      );
    }) ?? null
  );
}

export function normalizeEntryPreferences(prefs: TablePreferences): TablePreferences {
  const tab = entryTab(prefs.filters);
  const page = prefs.pagination?.page;
  const size = prefs.pagination?.itemsPerPage;
  const validSize = [10, 25, 50, 100].includes(size);
  const validSort = sameValues(prefs.sort, ["created_at", "id"]) && prefs.sort[0] === "created_at";
  return {
    ...prefs,
    filters: entryTabFilters(tab ?? "All"),
    sort: ["created_at", "id"],
    pagination: {
      page: tab && validSort && Number.isInteger(page) && page > 0 && validSize ? page : 1,
      itemsPerPage: validSize ? size : 10,
    },
  };
}
