import { createBackendDataSource, encodeModel, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { Role } from "@/data/model/iam/accounts/auth/constants";
import type { RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

@type("iam:accounts")
export class AccountRecord extends Record {
  @field() public name!: string;
  @field() public readonly email!: string;

  @field() public readonly sso_channel!: string | null;

  @field() public enabled!: boolean;
  @field() public role_name!: Role | null;
  @field() public role_scope!: Hash;

  @field() public readonly picture_url!: string | null;
  @field() public readonly joined_at!: Date | null;

  @field() public readonly invitation_expired_at!: Date | null;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(AccountRecord);

const accountBasePath: string = `/api/v1/iam/accounts`;

export const accountsBackendDataSource = createBackendDataSource(AccountRecord, accountBasePath, {
  join: async (params: { token: string }): Promise<RecordResponse<AccountRecord> | { data: null; meta?: Hash }> => {
    const res = await fetch(`${accountBasePath}/${params.token}/join`, {
      method: "PATCH",
      body: encodeModel(AccountRecord, { attributes: { joined_at: new Date() } }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(accountBasePath, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error assigning entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body) {
      if (body.data) return Promise.resolve(parseSingleElementReturn<AccountRecord>(body));

      return Promise.resolve(body);
    }

    throw "No data returned";
  },

  resend_invitation: async (params: { id: string }) => {
    const { id: accountId } = params;

    const res = await fetch(`${accountBasePath}/${accountId}/resend_invitation`, {
      method: "POST",
      body: JSON.stringify({ id: accountId }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error resending invitation: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body) {
      clearCache(resourcePath(accountBasePath, null, undefined));
      return Promise.resolve(body);
    }

    throw "No data returned";
  },

  /**
   * Invite an account (guarded). Sends the raw attributes as the JSON body;
   * the IAM endpoint accepts `name`, `email`, `role_name` and `role_scope`.
   */
  invite: async (params: { name?: string; email: string; role_name?: string; role_scope?: Hash }) => {
    const res = await fetch(`${accountBasePath}/invite`, {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        role_name: params.role_name,
        role_scope: params.role_scope,
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error inviting account: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body) {
      clearCache(resourcePath(accountBasePath, null, undefined));
      return Promise.resolve(parseSingleElementReturn<AccountRecord>(body));
    }

    throw "No data returned";
  },
});
