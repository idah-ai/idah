import { createBackendDataSource, encodeModel, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { Hash } from "@/utils/types";

@type("iam:accounts")
export class AccountRecord extends Record {
  @field() public name!: string;
  @field() public email!: string;

  @field() public sso_channel!: string | null;

  @field() public enabled!: boolean;

  @field() public joined_at!: Date | null;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(AccountRecord);

const accountBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/accounts`;

export const accountsBackendDataSource = createBackendDataSource(AccountRecord, accountBasePath, {
  join: async (params: { id: string }): Promise<{ data: null }> => {
    const res = await fetch(`${accountBasePath}/${params.id}/join`, {
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
    console.log(body);

    if (body) {
      return Promise.resolve(body);
    }

    throw "No data returned";
  },
});
