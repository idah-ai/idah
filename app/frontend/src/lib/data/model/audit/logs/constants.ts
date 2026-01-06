import type { LabelValue } from "@/components/app/types";

export const logResourceTypes: LabelValue<string>[] = [
  /** IAM */
  { label: "Accounts", value: "accounts" },
  { label: "Account Sessions", value: "account_sessions" },
  { label: "Organizations", value: "organizations" },

  /** DATASET */
  { label: "Datasets", value: "datasets" },
  { label: "Entries", value: "entries" },
  { label: "Projects", value: "projects" },
  { label: "Project Members", value: "project_members" },

  /** MEDIA */
  { label: "Medias", value: "medias" },
];

export type LogAction =
  | "created"
  | "updated"
  | "deleted"
  | "logged_in"
  | "logged_out"
  | "assigned"
  | "unassigned"
  | "submitted";
export const logActions: LabelValue<LogAction>[] = [
  { label: "Created", value: "created" },
  { label: "Updated", value: "updated" },
  { label: "Deleted", value: "deleted" },

  { label: "Login", value: "logged_in" },
  { label: "Logout", value: "logged_out" },

  { label: "Assigned", value: "assigned" },
  { label: "Unassigned", value: "unassigned" },

  { label: "Submitted", value: "submitted" },
];
