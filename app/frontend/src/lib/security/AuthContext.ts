import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { writable, type Writable } from "svelte/store";

import { AccountAuthRecord, type AuthService } from "@/data/model/iam/accounts/auth/records";

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

    await goto(resolve("/login"), { replaceState: true });
  }

  public readonly email: string;
  public readonly name: string | null;
  public readonly pictureUrl: string | null;

  public readonly roleName: string;
  public readonly roleScope: Hash;
  public readonly roleRights: string[] = [];

  public readonly exp: number;

  constructor(record: AccountAuthRecord | Hash) {
    this.email = record.email;
    this.name = record.name;
    this.pictureUrl = record.picture_url;

    this.roleName = record.role_name;
    this.roleScope = record.role_scope;
    this.roleRights = record.role_rights || [];

    this.exp = record.exp * 1000;
  }
}
