import type { ProjectMemberRole } from "@/data/model/dataset/projects/members/record";

export const actions = [
  //
  "login",
  "logout",
  //
  "create",
  "read",
  "update",
  "delete",
] as const;

export type Action = (typeof actions)[number];

export const resources = [
  /** IAM */
  "iam:accounts",
  "iam:account_sessions",
  "iam:organizations",

  /** DATASET */
  "dataset:datasets",
  "dataset:entries",
  "dataset:projects",
  "dataset:project_members",

  /** AUDIT */
  "audit:logs",

  /** SETTINGS */
  "setting:account_settings",
] as const;

export type Resource = (typeof resources)[number];

export const scopes = ["as_user", "as_org_owner"] as const;

export type ProjectMemberScope = {
  projectId: string;
  projectMemberRoles: ProjectMemberRole[];
};

export type Scope = (typeof scopes)[number] | { as_user: ProjectMemberScope };
