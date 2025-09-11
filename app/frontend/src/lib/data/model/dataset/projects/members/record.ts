import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

@type("dataset:project_members")
export class ProjectMemberRecord extends Record {
  @field() public project_id!: string; // UUID

  @field() public account_id!: number;
  @field() public name!: string | null;
  @field() public email!: string;

  @field() public role!: string;

  @field() public invited_by_id!: number;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(ProjectMemberRecord);

export const projectMembersBackendDataSource = createBackendDataSource(
  ProjectMemberRecord,
  "https://idah.localhost:8443/api/v1/dataset/project_members",
);

export const projectMemberRoles = [
  { label: "Annotator", value: "annotator" },
  { label: "Reviewer", value: "reviewer" },
  { label: "Project Manager", value: "project_manager" },
  { label: "Admin", value: "Admin" },
];
