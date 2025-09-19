import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type DatasetTab = "tasks" | "analytics" | "labels";

export const datasetTabs: BaseTabs<DatasetTab> = [
	{ label: "Tasks", value: "tasks" },
	{ label: "Analytics", value: "analytics" },
	{ label: "Label Editor", value: "labels" },
];
