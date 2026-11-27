import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { ConnectionResult } from "@/data/model/setting/storage_target/utils";
import type { Hash } from "@/utils/types";

/**
 * An S3 location an admin registers so a project's files can be kept apart
 * from other customers' data. The backend never returns anything of the secret
 * key: the access key ID is what tells credentials apart.
 */
@type("setting:storage_targets")
export class StorageTargetRecord extends Record {
  @field() public name!: string;

  @field() public endpoint!: string;
  @field() public region!: string | null;
  @field() public bucket!: string;
  @field() public prefix!: string | null;
  /** Path-style addressing (endpoint/bucket/key), which MinIO, Ceph and most self-hosted S3 need. */
  @field() public path_style!: boolean;

  @field() public access_key_id!: string;
  /** Write-only: a new secret on create or update. Never in a response. */
  @field() public secret_access_key!: string | null;

  @field() public organization_ids!: number[];
  @field() public enabled!: boolean;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
}

RecordFactory.registerTypes(StorageTargetRecord);

/** A target as a project creator sees it: no credentials. */
export type StorageTargetSummary = {
  id: string;
  name: string;
  endpoint: string;
  bucket: string;
};

export const storageTargetsBasePath: string = `/api/v1/setting/storage_targets`;

async function requestJson(url: string, init: RequestInit = {}): Promise<Hash> {
  // A JSON content type with an empty body is refused as a bad request.
  const headers: HeadersInit = init.body ? { "Content-Type": "application/vnd.api+json" } : {};

  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await res.json();

  if (body && body.errors) {
    return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
  }

  return body;
}

export const storageTargetsBackendDataSource = createBackendDataSource(StorageTargetRecord, storageTargetsBasePath, {
  /** The targets the current user may pick for a new project of an organization. */
  available: async (params: { organizationId?: number | null } = {}): Promise<StorageTargetSummary[]> => {
    const query = params.organizationId ? `?organization_id=${encodeURIComponent(params.organizationId)}` : "";
    const body = await requestJson(`${storageTargetsBasePath}/_available${query}`, { method: "GET" });

    return (body.data || []).map((item: Hash) => ({ id: item.id, ...item.attributes }));
  },

  /** Tests values from the form before they are saved. */
  testConnection: async (values: Hash): Promise<ConnectionResult> => {
    const body = await requestJson(`${storageTargetsBasePath}/_test`, {
      method: "POST",
      body: JSON.stringify(values),
    });

    return body.data as ConnectionResult;
  },

  /** Tests a saved target with its stored credentials. */
  testSaved: async (id: string): Promise<ConnectionResult> => {
    const body = await requestJson(`${storageTargetsBasePath}/${id}/_test`, { method: "POST" });

    return body.data as ConnectionResult;
  },

  /** Forgets the cached targets, after a change made outside create/update/delete. */
  clearCached: (): void => {
    clearCache(resourcePath(storageTargetsBasePath, null, undefined));
  },
});
