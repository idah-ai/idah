import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("iam:api_keys")
export class ApiKeyRecord extends Record {
  @field() public name!: string;

  @field() public scope_type!: string;
  @field() public permissions!: string[];
  @field() public organizations!: string[];
  @field() public projects!: string[];


  @field() public readonly picture_url!: string | null;
  @field() public readonly last_used!: Date | null;

  @field() public readonly expired_at!: Date | null;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(ApiKeyRecord);

const apiKeyBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/api_keys`;

export const apiKeysBackendDataSource = createBackendDataSource(ApiKeyRecord, apiKeyBasePath, {});
