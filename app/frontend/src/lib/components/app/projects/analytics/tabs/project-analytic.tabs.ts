import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type ProjectAnalyticTab = "overview" | "performance";

export const projectAnalyticTabs: BaseTabs<ProjectAnalyticTab> = [
	{ label: "Overview", value: "overview" },
	{ label: "Performance", value: "performance" },
];
