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
  "invite",
] as const;

export type Action = (typeof actions)[number];

export const resources = [
  /** IAM */
  "iam:accounts",
  "iam:account_sessions",
  "iam:organizations",
  "iam:api_keys",

  /** DATASET */
  "dataset:datasets",
  "dataset:entries",
  "dataset:projects",
  "dataset:project_members",
  "dataset:label_config_templates",
  "dataset:feedback_config_templates",
  "dataset:note_feeds",

  /** AUDIT */
  "audit:logs",

  /** SETTINGS */
  "setting:account_settings",

  /** SYNC */
  "sync:jobs",
  "sync:exports",

  /** NOTIFICATION */
  "notification:webhooks",
  "notification:jobs",
] as const;

export type Resource = (typeof resources)[number];

export const scopes = ["as_user", "as_org_owner"] as const;

export type ProjectMemberScope = {
  projectId: string;
  projectMemberRoles: ProjectMemberRole[];
};

export type NamedScope = (typeof scopes)[number];

export type Scope = NamedScope | { as_user: ProjectMemberScope };
