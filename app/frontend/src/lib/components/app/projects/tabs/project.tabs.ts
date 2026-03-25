import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type ProjectTab = "datasets" | "members" | "exports";

export const projectTabs: BaseTabs<ProjectTab> = [
  { label: "Datasets", value: "datasets" },
  { label: "Datasets Exports", value: "exports" },
  { label: "Members", value: "members" },
];
