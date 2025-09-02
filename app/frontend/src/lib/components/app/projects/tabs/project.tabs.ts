import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type ProjectTab = "tasks" | "analytics" | "labels" | "members";

export const projectTabs: BaseTabs<ProjectTab> = [
	{ label: "Tasks", value: "tasks" },
	{ label: "Analytics", value: "analytics" },
	{ label: "Label Editor", value: "labels" },
	{ label: "Members", value: "members" },
];
