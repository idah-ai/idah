import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { AccountRecord } from "@/data/model/iam/accounts/record";
import { adminsScopeTypes, apiKeyStatuses, type ApiKeyStatusBadgeProps } from "@/data/model/iam/api-keys/constants";
import { parseSingleElementError } from "@/data/model/json_api";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { Hash } from "@/utils/types";

@type("iam:api_keys")
export class ApiKeyRecord extends Record {
  @field() public readonly account_id!: number;
  @field() public readonly key_label!: string;
  @field() public readonly key_sha!: string;

  @field() public permissions!: string[];

  @field() public name!: string;
  @field() public scope_type!: string;
  @field() public scope_value!: string[];

  @field() public expires_at!: Date | null;
  @field() public readonly revoked_at!: Date | null;

  @field() public status!: string;

  @field() public readonly last_used_at!: Date | null;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;

  @field() public key!: string;

  @relationship() public service_account!: AccountRecord;

  public get statusBadge(): ApiKeyStatusBadgeProps {
    const defaultBadgeProps: ApiKeyStatusBadgeProps = {
      label: "Pending",
      value: "pending",
      variant: "warning",
    };

    const foundApiKeyStatus = apiKeyStatuses.find((s) => s.value === this.status);

    return foundApiKeyStatus ?? defaultBadgeProps;
  }

  public get scopeTypeLabel(): string {
    const foundApiKeyScopeType = adminsScopeTypes.find((s) => s.value === this.scope_type);

    return foundApiKeyScopeType ? foundApiKeyScopeType.label : "Unknown";
  }
}

RecordFactory.registerTypes(ApiKeyRecord);

const apiKeyBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/api_keys`;

export const apiKeysBackendDataSource = createBackendDataSource(ApiKeyRecord, apiKeyBasePath, {
  permission_list: async (params: { scope_type: string }) => {
    const { scope_type } = params;
    const res = await fetch(`${apiKeyBasePath}/permissions/${scope_type}`, {
      method: "GET",
    });

    const body = await res.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error fetching permissions: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(body);
    }

    throw "No data returned";
  },
  revoke: async (params: { id: string }) => {
    const { id } = params;

    const res = await fetch(`${apiKeyBasePath}/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error revoking API key: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body) {
      clearCache(resourcePath(apiKeyBasePath, null, undefined));
      return Promise.resolve(body);
    }

    throw "No data returned";
  },
});