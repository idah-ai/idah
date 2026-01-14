import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("iam:account_sessions")
export class AccountSessionRecord extends Record {
  @field() public readonly account_id!: number;

  @field() public user_agent!: string;
  @field() public ip!: string;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(AccountSessionRecord);

const accountSessionBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/account_sessions`;

export const accountSessionsBackendDataSource = createBackendDataSource(
  AccountSessionRecord,
  accountSessionBasePath,
  {},
);
