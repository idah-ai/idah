import type { LabelValue } from "@/components/app/types";

export const logResourceTypes: LabelValue<string>[] = [
  /** IAM */
  { label: "Accounts", value: "accounts" },

  /** DATASET */
  { label: "Annotations", value: "annotations" },
  { label: "Datasets", value: "datasets" },
  { label: "Entries", value: "entries" },
  { label: "Projects", value: "projects" },
  { label: "Project Members", value: "project_members" },
];

export type LogAction = "created" | "updated" | "deleted";
export const logActions: LabelValue<LogAction>[] = [
  { label: "Created", value: "created" },
  { label: "Updated", value: "updated" },
  { label: "Deleted", value: "deleted" },
];
