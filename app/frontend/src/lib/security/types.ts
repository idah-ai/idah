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
] as const;

export type Resource = (typeof resources)[number];

export const scopes = ["as_user"] as const;

export type Scope = (typeof scopes)[number];
