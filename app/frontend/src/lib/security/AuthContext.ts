import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { writable, type Writable } from "svelte/store";

import { clearAllCache } from "@/data/Cache";
import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
import { AccountAuthRecord, type AuthService } from "@/data/model/iam/accounts/auth/records";
import { ActionMap } from "@/security/ActionMap";
import { rank } from "@/security/roleHierarchy";

import type { Role } from "@/data/model/iam/accounts/auth/constants";
import type { Action, Resource, Scope } from "@/security/types";
import type { Hash } from "@/utils/types";

export type AuthenticationStatus = {
  status: "loading" | "logged-in" | "logged-out";
  authContext: AuthContext | null;
};

export const authStatus: Writable<AuthenticationStatus> = writable({
  status: "loading",
  authContext: null,
});

export class AuthContext {
  public static backend: AuthService;

  public static currentAuthContextPromise: Promise<AuthContext | undefined>;
  public static currentAuthContext: AuthContext | undefined;

  static async setAuthStatus(status: "loading" | "logged-in" | "logged-out", authContext: AuthContext | null) {
    authStatus.set({
      status,
      authContext,
    });
  }

  static async signInWithEmailAndPassword(email: string, password: string) {
    try {
      const out = await this.backend.signInWithEmailAndPassword(email, password);
      const data = out.data;

      const context: AccountAuthRecord = new AccountAuthRecord(data);
      const ctx = new AuthContext(context);

      this.currentAuthContext = ctx;
      this.setAuthStatus("logged-in", ctx);

      return ctx;
    } catch (e) {
      this.setAuthStatus("logged-out", null);

      throw e;
    }
  }

  static async refresh() {
    try {
      const out = await this.backend.refresh();
      const data = out.data;

      const context = Object.assign({}, data.attributes, { id: data.id });
      const ctx = new AuthContext(context);

      this.currentAuthContext = ctx;
      this.setAuthStatus("logged-in", ctx);

      return ctx;
    } catch (e) {
      this.setAuthStatus("logged-out", null);

      throw e;
    }
  }

  static async logout() {
    try {
      await this.backend.signOut();
    } catch (e) {
      console.error(e);
    }

    // window.AppCable.cable.disconnect();

    this.currentAuthContext?.clearEffectiveProjectRankCache();
    this.setAuthStatus("logged-out", null);
    clearAllCache();

    await goto(resolve("/login"), { replaceState: true });
  }

  public readonly actionMap: ActionMap;

  public readonly id: string;

  public readonly email: string;
  public readonly name: string | null;
  public readonly pictureUrl: string | null;

  public readonly roleName: Role;
  public readonly roleScope: Hash;
  public readonly roleRights: string[] = [];

  public readonly exp: number;

  /** Memoized effective-project-rank promises, keyed by project id. Cleared on
   *  logout and on role/scope change so stale ranks are never served. */
  private effectiveProjectRankCache: Map<string, Promise<number | null>> = new Map();

  constructor(record: AccountAuthRecord | Hash) {
    this.actionMap = new ActionMap(record.role_rights || []);

    this.id = record.id;

    this.email = record.email;
    this.name = record.name;
    this.pictureUrl = record.picture_url;

    this.roleName = record.role_name;
    this.roleScope = record.role_scope;
    this.roleRights = record.role_rights || [];

    this.exp = record.exp * 1000;
  }

  isRole(roleToCheck: Role): boolean {
    return this.roleName === roleToCheck;
  }

  /**
   * The actor's effective rank on a project, mirroring the backend
   * `ProjectAccess::Service.effective_rank`. This is the highest of:
   *   - the account role if it covers the project (admin/system everywhere,
   *     org_owner when the project's org is in `role_scope.org`);
   *   - the actor's enabled membership role on that project.
   * Returns null when the actor has no access to the project.
   */
  async effectiveProjectRank(projectId: string): Promise<number | null> {
    const roleName = String(this.roleName);
    if (roleName === "admin" || roleName === "system") return rank("system");

    const cached = this.effectiveProjectRankCache.get(projectId);
    if (cached) return cached;

    const promise = this.computeEffectiveProjectRank(projectId);
    // Drop the entry on rejection so a transient error doesn't stick until the
    // next refresh — the next call retries the fetch.
    promise.catch(() => {
      this.effectiveProjectRankCache.delete(projectId);
    });
    this.effectiveProjectRankCache.set(projectId, promise);
    return promise;
  }

  private async computeEffectiveProjectRank(projectId: string): Promise<number | null> {
    const project = await projectsBackendDataSource.get(projectId, {
      fields: {
        [ProjectRecord.type]: ["organization_id"],
      },
    });
    const orgIds = (this.roleScope?.org || []).map(String);
    if (orgIds.includes(String(project.data.organization_id))) return rank("org_owner");

    const membership = await this.membershipOn(projectId);
    return membership ? rank(String(membership.role)) : null;
  }

  /** Clear the memoized effective-project-rank cache (e.g. on logout or role change). */
  clearEffectiveProjectRankCache(): void {
    this.effectiveProjectRankCache.clear();
  }

  /** The actor's enabled membership on a project, if any. */
  async membershipOn(projectId: string): Promise<ProjectMemberRecord | null> {
    const res = await projectMembersBackendDataSource.list({
      fields: {
        [ProjectMemberRecord.type]: ["id", "role", "disabled_at"],
      },
      filters: {
        project_id: projectId,
        account_id: this.id,
        enabled: true,
      },
    });

    return res.data[0] || null;
  }

  /*
   * Tell whether the account can perform the given action on the given resource
   */
  hasScope(action: Action, resource: Resource, scope?: Scope): boolean {
    const rights = this.actionMap.get(action, resource);

    if (!scope) return !!rights;

    if (!rights) return false;

    return rights.includes(scope) || rights.includes("*") || rights.includes("all");
  }

  async can(action: Action, resource: Resource, scopes?: Scope[]): Promise<boolean> {
    let result = false;

    if (!scopes) {
      return this.hasScope(action, resource);
    } else {
      for (const scope of scopes) {
        if (typeof scope === "string") {
          if (this.hasScope(action, resource, scope)) {
            result = true;
            break;
          }
        }

        /** If scopes contains "as_user" object */
        if (typeof scope === "object") {
          const { projectId, projectMemberRoles } = scope["as_user"];

          const currentAccountProjectMember = await this.membershipOn(projectId);
          if (!currentAccountProjectMember) return false;

          if (projectMemberRoles.includes(currentAccountProjectMember.role)) {
            result = true;
            break;
          } else {
            result = false;
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Whether the actor can perform a project-scoped action, decided on their
   * effective rank on the concrete project (mirroring the backend). Unlike the
   * `as_org_owner` scope (which is true for any org_owner regardless of the
   * project), this evaluates an org_owner who is only a member of a foreign
   * project with their membership role, not org_owner powers.
   *
   * `minRole` is the lowest effective role that may perform the action, e.g.
   * "project_owner" for dataset/entry/project/member management and sync
   * exports, or "annotator" for annotation/note creation.
   */
  async canOnProject(action: Action, resource: Resource, projectId: string, minRole: string): Promise<boolean> {
    if (!this.hasScope(action, resource)) return false;

    const effectiveRank = await this.effectiveProjectRank(projectId);
    return effectiveRank !== null && effectiveRank >= rank(minRole);
  }
}
