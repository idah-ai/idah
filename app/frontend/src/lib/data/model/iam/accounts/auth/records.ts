import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

import type { RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

@type("iam:account_auths")
export class AccountAuthRecord extends Record {
  @field() public email!: string;
  @field() public name!: string;
  @field() public picture_url!: string;

  @field() public role_name!: string;
  @field() public role_scope!: Hash;

  @field() public role_rights!: string[];

  @field() public exp!: number;
}

const accountAuthBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/auth`;

RecordFactory.registerTypes(AccountAuthRecord);

export interface AuthService {
  signInWithEmailAndPassword: (email: string, passowrd: string) => Promise<RecordResponse<AccountAuthRecord>>;
  refresh: () => Promise<RecordResponse<AccountAuthRecord>>;
  signOut: () => Promise<void>;
}

export const accountAuthService = (basePath: string = accountAuthBasePath): AuthService => {
  return {
    signInWithEmailAndPassword: async (email: string, password: string) => {
      const response = await fetch(`${basePath}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
          cookie: true,
        }),
      });

      const body = await response.json();

      if (body && body.errors) {
        return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
      }

      if (body && body.data) {
        return Promise.resolve(parseSingleElementReturn<AccountAuthRecord>(body));
      }

      throw "No data returned";
    },
    refresh: async () => {
      const response = await fetch(`${basePath}/refresh`, {
        method: "GET",
      });

      const body = await response.json();

      if (body && body.errors) {
        return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
      }

      if (body && body.data) {
        return body;
      }

      throw "No data returned";
    },
    signOut: async () => {
      await fetch(`${basePath}/logout`, {
        method: "GET",
      });
    },
  };
};
