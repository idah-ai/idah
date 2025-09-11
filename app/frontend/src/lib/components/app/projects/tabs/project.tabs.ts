import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type ProjectTab = "members" | "datasets";

export const projectTabs: BaseTabs<ProjectTab> = [
	{ label: "Datasets", value: "datasets" },
	{ label: "Members", value: "members" },
];
