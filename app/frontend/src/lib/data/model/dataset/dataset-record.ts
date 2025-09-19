import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import type { Hash } from "@/utils/types";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: Hash;
  @field() public workflow_configuration!: Hash;
  @field() public status!: string;
  @field() public progress!: Date;
  @field() public updated_at!: Date;
  @field() public created_at!: string;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(DatasetRecord);

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  "https://idah.localhost:8443/api/v1/dataset/datasets",
);
