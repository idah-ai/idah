import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { projectsBackendDataSource, type ProjectRecord } from "@/data/model/dataset/projects/project-record";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: string;
  @field() public workflow_configuration!: string;
  @field() public status!: string;
  @field() public progress!: Date;
  @field() public updated_at!: Date;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(DatasetRecord);

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  "https://idah.localhost:8443/api/v1/dataset/datasets",
);
