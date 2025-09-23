import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type LabelTab = "manual" | "properties" | "json";

export const labelTabs: BaseTabs<LabelTab> = [
  { label: "Manual Edition", value: "manual" },
  { label: "JSON", value: "json" },
];
