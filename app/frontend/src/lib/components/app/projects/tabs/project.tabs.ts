import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type ProjectTab = "datasets" | "dashboard" | "members" | "exports";

export const projectTabs: BaseTabs<ProjectTab> = [
  { label: "Datasets", value: "datasets" },
  { label: "Dashboard", value: "dashboard" },
  { label: "Exports", value: "exports" },
  { label: "Members", value: "members" },
];
