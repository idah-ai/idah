import type { LabelValue } from "@/components/app/types";
import type { BadgeVariant } from "@/components/ui/badge";

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
export interface ILogAction extends LabelValue<LogAction> {
  badgeVariant: BadgeVariant;
}
export const logActions: ILogAction[] = [
  { label: "Created", value: "created", badgeVariant: "success" },
  { label: "Updated", value: "updated", badgeVariant: "default" },
  { label: "Deleted", value: "deleted", badgeVariant: "destructive" },
];
