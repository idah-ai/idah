import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("iam:organizations")
export class OrganizationRecord extends Record {
  @field() public name!: string;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(OrganizationRecord);

export const organizationsBackendDataSource = createBackendDataSource(
  OrganizationRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/organizations`,
);
