import type { LabelValue } from "@/components/app/ComponentApp.types";

export type ProjectTab = "tasks" | "analytics" | "labels" | "members";

export const projectTabs: LabelValue<ProjectTab>[] = [
	{ label: "Tasks", value: "tasks" },
	{ label: "Analytics", value: "analytics" },
	{ label: "Label Editor", value: "labels" },
	{ label: "Members", value: "members" },
];
