import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type DatasetTab = "entries" | "exports" | "analytics" | "labels";

export const datasetTabs: BaseTabs<DatasetTab> = [
  { label: "Entries", value: "entries" },
  { label: "Entry Exports", value: "exports" },
  // { label: "Analytics", value: "analytics" },
  { label: "Label Editor", value: "labels" },
];
