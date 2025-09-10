import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

@type("dataset:project_members")
export class ProjectMemberRecord extends Record {
  @field() public project_id!: string;

  @field() public user_id!: string;
  @field() public name!: string;
  @field() public email!: string;

  @field() public role!: string;

  @field({ transformer: Transformers.Time }) public invited_at!: Date;
  @field() public invited_by_id!: string;
  @field({ transformer: Transformers.Time }) public joined_at!: Date | null;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(ProjectMemberRecord);

export const projectMembersBackendDataSource = createBackendDataSource(
  ProjectMemberRecord,
  "https://idah.localhost:8443/api/v1/dataset/project_members",
);
