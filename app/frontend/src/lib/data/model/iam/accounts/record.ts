import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { Hash } from "@/utils/types";

@type("iam:accounts")
export class AccountRecord extends Record {
  @field() public name!: string;
  @field() public readonly email!: string;

  @field() public readonly sso_channel!: string | null;

  @field() public enabled!: boolean;
  @field() public role_name!: string | null;
  @field() public role_scope!: Hash;

  @field() public readonly picture_url!: string | null;

  @field() public readonly joined_at!: Date | null;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
}

RecordFactory.registerTypes(AccountRecord);

export const accountsBackendDataSource = createBackendDataSource(
  AccountRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/accounts`,
);
