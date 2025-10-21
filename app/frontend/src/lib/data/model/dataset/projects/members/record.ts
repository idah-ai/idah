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

  @field() public access!: string;

  @field() public invited_by_id!: number;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(ProjectMemberRecord);

export const projectMembersBackendDataSource = createBackendDataSource(
  ProjectMemberRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/project_members`,
);

export const projectMemberAccess = [
  { label: "Owner", value: "owner" },
  { label: "Annotator", value: "annotator" },
  { label: "Reviewer", value: "reviewer" },
];
