import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("dataset:projects")
export class ProjectRecord extends Record {
  @field() public name!: string;
  @field() public description!: string;

  @field() public created_by_id!: string;
  @field() public created_at!: string;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(ProjectRecord);

export const projectsBackendDataSource = createBackendDataSource(
  ProjectRecord,
  "https://idah.localhost:8443/api/v1/dataset/projects",
);
