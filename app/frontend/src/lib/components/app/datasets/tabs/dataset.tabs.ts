import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type DatasetTab = "entries" | "analytics" | "labels" | "logs";

export const datasetTabs: BaseTabs<DatasetTab> = [
  { label: "Entries", value: "entries" },
  // { label: "Analytics", value: "analytics" },
  { label: "Label Editor", value: "labels" },
  { label: "Audit Logs", value: "logs" },
];
