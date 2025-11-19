import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";
import { EntryRecord } from "@/data/model/dataset/entries/record";
import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

@type("dataset:projects")
export class ProjectRecord extends Record {
  @field() public name!: string;
  @field() public description!: string;
  @field() public organization_id!: number;
  @field() public readonly created_by_email!: string;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;

  @relationship() public project_members!: ProjectMemberRecord[];
  @relationship() public datasets!: DatasetRecord[];
  @relationship() public entries!: EntryRecord[];
  @relationship() public annotations!: AnnotationRecord[];
  @relationship() public note_feeds!: NoteFeedRecord[];
}

RecordFactory.registerTypes(ProjectRecord);

export const projectsBackendDataSource = createBackendDataSource(
  ProjectRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/projects`,
);
