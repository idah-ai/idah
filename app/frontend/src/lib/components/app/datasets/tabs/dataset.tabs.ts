import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type DatasetTab = "entries" | "labels" | "feedback-configuration";

export const datasetTabs: BaseTabs<DatasetTab> = [
  { label: "Entries", value: "entries" },
	{ label: "Label Editor", value: "labels" },
  { label: "Feedback Configuration", value: "feedback-configuration" },
];
