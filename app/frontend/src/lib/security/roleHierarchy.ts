/**
 * Pure role-hierarchy helpers for the frontend, mirroring the backend
 * `RoleHierarchy` (`common/lib/role_hierarchy.rb`). No I/O: it only reasons
 * about role names and their masks.
 *
 * Account roles keep their masks from `common/data/roles/*.yml`; project roles
 * live in `common/data/project_roles.yml`. The single chain is:
 *   user (1.0.0) < annotator (1.10.0) < reviewer (1.20.0) <
 *   project_owner (1.30.0) < org_owner (2.0.0) < admin (8.0.0) < system (9.9.9)
 */

export const ROLE_MASKS: Record<string, string> = {
  // Account roles
  user: "1.0.0",
  org_owner: "2.0.0",
  admin: "8.0.0",
  system: "9.9.9",
  // Project roles
  annotator: "1.10.0",
  reviewer: "1.20.0",
  project_owner: "1.30.0",
};

export const PROJECT_ROLES = ["annotator", "reviewer", "project_owner"] as const;

export const ACCOUNT_ROLES = ["user", "org_owner", "admin"] as const;

/**
 * The numeric rank of an account or project role. Masks are compared part by
 * part (major, minor, patch) like the backend `SemanticVersion`; the packed
 * integer preserves that ordering for the fixed set of roles.
 */
export function rank(roleName: string): number {
  const mask = ROLE_MASKS[roleName];
  if (!mask) throw new Error(`Unknown role \`${roleName}\``);

  const [major, minor, patch] = mask.split(".").map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
}

/**
 * Whether an actor may assign the given account role to a target, per the
 * account-level rules:
 *   - an actor may assign a role ranked strictly below their own, except
 *   - admin → admin, and
 *   - org_owner → org_owner (restricted to the actor's own orgs, enforced by
 *     the caller).
 */
export function canAssignAccountRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "admin" && targetRole === "admin") return true;
  if (actorRole === "org_owner" && targetRole === "org_owner") return true;

  return rank(actorRole) > rank(targetRole);
}

/**
 * Whether an actor with the given effective rank on a project may assign the
 * given project role. Only effective rank >= project_owner can invite/manage;
 * assigning project_owner requires effective rank >= org_owner.
 */
export function canAssignProjectRole(actorRank: number, targetRole: string): boolean {
  if (targetRole === "project_owner") return actorRank >= rank("org_owner");

  return actorRank >= rank("project_owner") && actorRank > rank(targetRole);
}

/**
 * Whether an actor with the given effective rank may manage an existing member
 * whose current role is `targetCurrentRole`. A project_owner can manage rows up
 * to and including project_owner; org_owner/admin manage everything.
 */
export function canManageProjectMember(actorRank: number, targetCurrentRole: string): boolean {
  return actorRank >= rank("project_owner") && actorRank >= rank(targetCurrentRole);
}

/** The project roles an actor with the given effective rank may assign. */
export function filterAssignableProjectRoles(actorRank: number, roles: readonly string[]): string[] {
  return roles.filter((role) => canAssignProjectRole(actorRank, role));
}

/** The account roles an actor may assign (for the invite form). */
export function filterAssignableAccountRoles(actorRole: string, roles: readonly string[]): string[] {
  return roles.filter((role) => canAssignAccountRole(actorRole, role));
}
