import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";

@type("dataset:note_comments")
export class NoteCommentRecord extends Record {
  @field() public note_feed_id!: string;

  @field() public is_edited!: boolean;

  @field() public content_md!: string;

  @field() public readonly created_by_email!: string;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
  @field({ transformer: Transformers.Time }) public edited_at!: Date;

  @relationship() public note_feed!: NoteFeedRecord;
}

RecordFactory.registerTypes(NoteCommentRecord);

export const noteCommentsBackendDataSource = createBackendDataSource(
  NoteCommentRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/note_comments`,
);
