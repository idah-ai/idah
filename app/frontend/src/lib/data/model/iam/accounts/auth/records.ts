import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import type { Hash } from "@/utils/types";

@type("iam:account_auths")
export class AccountAuthRecord extends Record {
  @field() public email!: string;
  @field() public name!: string;
  @field() public picture_url!: string;

  @field() public role_name!: string;
  @field() public scopes!: Hash;
  @field() public role_rights!: string[];

  @field() public exp!: number;
}

RecordFactory.registerTypes(AccountAuthRecord);

export const accountsBackendDataSource = createBackendDataSource(
  AccountAuthRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/account_auths`,
);
