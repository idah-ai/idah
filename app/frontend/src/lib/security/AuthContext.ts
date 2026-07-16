import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { writable, type Writable } from "svelte/store";

import { clearAllCache } from "@/data/Cache";
import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
import { AccountAuthRecord, type AuthService } from "@/data/model/iam/accounts/auth/records";
import { ActionMap } from "@/security/ActionMap";

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

    this.setAuthStatus("logged-out", null);
    clearAllCache();

    await goto(resolve("/login"), { replaceState: true });
  }

  public readonly actionMap: ActionMap;

  // Dedupes concurrent as_user membership lookups within this auth session.
  // Keyed by `${projectId}:${accountId}`; caches the in-flight promise so N
  // simultaneous can() checks share one request. Scoped to the instance, so a
  // new AuthContext on login/refresh starts empty. Failures are not cached.
  private readonly projectMemberCache = new Map<string, Promise<ProjectMemberRecord | undefined>>();

  public readonly id: string;

  public readonly email: string;
  public readonly name: string | null;
  public readonly pictureUrl: string | null;

  public readonly roleName: Role;
  public readonly roleScope: Hash;
  public readonly roleRights: string[] = [];

  public readonly exp: number;

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

          const cacheKey = `${projectId}:${this.id}`;
          let lookup = this.projectMemberCache.get(cacheKey);
          if (!lookup) {
            lookup = projectMembersBackendDataSource
              .list({
                fields: {
                  [ProjectMemberRecord.type]: ["id", "role"],
                },
                filters: {
                  project_id: projectId,
                  account_id: this.id,
                },
              })
              .then((res) => res.data[0]);
            // Don't cache transient failures — allow a later retry.
            lookup.catch(() => this.projectMemberCache.delete(cacheKey));
            this.projectMemberCache.set(cacheKey, lookup);
          }

          const currentAccountProjectMember = await lookup;
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
}
