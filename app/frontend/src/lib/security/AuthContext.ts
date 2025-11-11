import { writable, type Writable } from "svelte/store";
import { AccountAuthRecord } from "@/data/model/iam/accounts/auth/records";
import type { AuthBackend } from "./AuthBackend";
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
  public static backend: AuthBackend;

  public static currentAuthContextPromise: Promise<AuthContext | undefined>;
  public static currentAuthContext: AuthContext | undefined;

  static async setAuthStatus(status: "loading" | "logged-in" | "logged-out", authContext: AuthContext | null) {
    authStatus.set({
      status,
      authContext,
    });
  }

  static async login(account: string, password: string) {
    try {
      const out = await this.backend.login(account, password);
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

  public readonly email: string;
  public readonly name: string | null;
  public readonly pictureUrl: string | null;

  public readonly role: string;
  public readonly scopes: Hash;

  public readonly exp: number;

  constructor(record: AccountAuthRecord | Hash) {
    this.email = record.email;
    this.name = record.name;
    this.pictureUrl = record.picture_url;

    this.scopes = record.scopes;
    this.role = record.role_name;

    this.exp = record.exp * 1000;
  }
}
