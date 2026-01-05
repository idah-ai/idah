import type { LabelValue } from "@/components/app/types";

export const logResourceTypes: LabelValue<string>[] = [
  /** IAM */
  { label: "Accounts", value: "accounts" },
  { label: "Organizations", value: "organizations" },

  /** DATASET */
  { label: "Annotations", value: "annotations" },
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
  | "login"
  | "logout"
  | "assigned"
  | "unassigned"
  | "submitted";
export const logActions: LabelValue<LogAction>[] = [
  { label: "Created", value: "created" },
  { label: "Updated", value: "updated" },
  { label: "Deleted", value: "deleted" },

  { label: "Login", value: "login" },
  { label: "Logout", value: "logout" },

  { label: "Assigned", value: "assigned" },
  { label: "Unassigned", value: "unassigned" },

  { label: "Submitted", value: "submitted" },
];
