import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("dataset:projects")
export class ProjectRecord extends Record {
  @field() public name!: string;
  @field() public description!: string;
  @field() public organization_id!: number;
  @field() public readonly created_by_email!: string;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
}

RecordFactory.registerTypes(ProjectRecord);

export const projectsBackendDataSource = createBackendDataSource(
  ProjectRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/projects`,
);
