import type { LabelValue } from "@/utils/types";

export const scopeTypes: LabelValue<string>[] = [
  { label: "All", value: "all" },
  { label: "Organization", value: "organization" },
  { label: "Project", value: "project" },
];

export const apiKeyPermissions: LabelValue<string>[] = [
  { label: "Organization Read-Only", value: "read" },
  { label: "Organization Read-Write", value: "write" },
];
