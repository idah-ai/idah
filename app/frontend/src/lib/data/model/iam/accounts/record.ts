import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

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

export const accountsBackendDataSource = createBackendDataSource(
  AccountRecord,
  "https://idah.localhost:8443/api/v1/iam/accounts",
);
