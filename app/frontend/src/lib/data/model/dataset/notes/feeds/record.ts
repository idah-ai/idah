import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
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
  @field() public readonly created_by_email!: string;

  @field() public anchor_type!: "entry" | "annotation";
  @field() public position!: Hash;

  @field() public readonly status!: "pending" | "resolved";

  @field() public content_md!: string;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly edited_at!: Date | null;

  @relationship() public entry!: EntryRecord;
  @relationship() public annotation!: AnnotationRecord;
  @relationship() public note_comments!: NoteCommentRecord[];

  public get noteType(): "general" | "video_frame" | "annotation" {
    if (this.annotation_id) return "annotation";

    if (this.anchor_type === "entry" && Object.keys(this.position || {}).length > 0) return "video_frame";

    return "general";
  }
}

RecordFactory.registerTypes(NoteFeedRecord);

const noteFeedBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/note_feeds`;

export const noteFeedsBackendDataSource = createBackendDataSource(NoteFeedRecord, noteFeedBasePath, {
  markAsResolved: async (noteFeedId: string) => {
    const res = await fetch(`${noteFeedBasePath}/${noteFeedId}/resolve`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(noteFeedBasePath, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      /** Not showing errors toast for now, only show "You are not authorized to do this action." */
      // if (body.errors.length > 0) {
      //   body.errors.forEach((err: Hash) => {
      //     console.error(`[NoteFeed][markAsResolved] ${err.status} - ${err.title}`);
      //   });
      // }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseSingleElementReturn<NoteFeedRecord>(body));
    }

    throw "No data returned";
  },
});
