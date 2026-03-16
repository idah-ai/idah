import type { LabelValue } from "@/utils/types";

export const scopeTypes: LabelValue<string | number>[] = [
  { label: "All", value: "all" },
  { label: "Organization", value: "organization" },
  { label: "Project", value: "project" },
];
