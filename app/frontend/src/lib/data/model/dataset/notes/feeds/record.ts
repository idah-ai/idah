import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
import { EntryRecord } from "@/data/model/dataset/entries/record";
import { NoteCommentRecord } from "@/data/model/dataset/notes/comments/record";

import type { Hash } from "@/utils/types";

@type("dataset:note_feeds")
export class NoteFeedRecord extends Record {
  @field() public entry_id!: string;
  @field() public annotation_id!: string | null;
  @field() public readonly created_by_id!: number;

  @field() public anchor_type!: string; // ['entry', 'annotation']
  @field() public position!: Hash;

  @field() public readonly status!: string; // ['pending', 'resolved']

  @field() public content_md!: string;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public entry!: EntryRecord;
  @relationship() public annotation!: AnnotationRecord;
  @relationship() public note_comments!: NoteCommentRecord[];
}

RecordFactory.registerTypes(NoteFeedRecord);

export const noteFeedsBackendDataSource = createBackendDataSource(
  NoteFeedRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/note_feeds`,
);
