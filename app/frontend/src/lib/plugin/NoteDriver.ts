import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";

import type { IListOptions, INoteComment, INoteDriver, INoteFeed } from "@/plugin/interface/Activity";

export function parseNoteFeedRecordToINoteFeed(record: NoteFeedRecord): INoteFeed {
  return {
    id: record.id,
    entry_id: record.entry_id,
    annotation_id: record.annotation_id,
    created_by_id: record.created_by_id,
    anchor_type: record.anchor_type,
    position: record.position,
    status: record.status,
    content_md: record.content_md,
    created_at: new Date(record.created_at).toString(),
    updated_at: new Date(record.updated_at).toString(),

    // Included relationships
    note_comments:
      record.note_comments?.map((comment: NoteCommentRecord) => parseNoteCommentRecordToINoteComment(comment)) || [],
  };
}

export function parseNoteCommentRecordToINoteComment(record: NoteCommentRecord): INoteComment {
  return {
    id: record.id,
    note_feed_id: record.note_feed_id,
    is_edited: record.is_edited,
    content_md: record.content_md,
    created_by_id: record.created_by_id,
    created_at: new Date(record.created_at).toString(),
    updated_at: new Date(record.updated_at).toString(),
  };
}

export function createNoteDriver(entryId: string): INoteDriver {
  return {
    /** NOTE::FEEDS */
    feeds: {
      create(data: Partial<INoteFeed>) {
        const { annotation_id, position, content_md } = data;
        return new Promise<INoteFeed>((resolve, reject) => {
          noteFeedsBackendDataSource
            .create({
              attributes: {
                entry_id: entryId,
                annotation_id,
                anchor_type: annotation_id ? "annotation" : "entry",
                position,
                content_md,
              },
            })
            .then(
              (v) => resolve(parseNoteFeedRecordToINoteFeed(v.data)),
              (v) => reject(v.error),
            );
        });
      },
      list(listOptions: IListOptions): Promise<Array<INoteFeed>> {
        return new Promise<Array<INoteFeed>>((resolve, reject) => {
          noteFeedsBackendDataSource
            .list({
              filters: { ...listOptions.filters, entry_id: entryId },
              pagination: listOptions.pagination,
              sort: listOptions.sort,
              included: ["note_comments"],
            })
            .then(
              (v) => resolve(v.data.map((note) => parseNoteFeedRecordToINoteFeed(note))),
              (v) => reject(v.error),
            );
        });
      },
      get(id: string) {
        return new Promise<INoteFeed>((resolve, reject) => {
          noteFeedsBackendDataSource
            .get(id, {
              included: ["note_comments"],
            })
            .then(
              (v) => resolve(parseNoteFeedRecordToINoteFeed(v.data)),
              (v) => reject(v.error),
            );
        });
      },
      update(id: string, data: Partial<INoteFeed>) {
        return new Promise<INoteFeed>((resolve, reject) => {
          noteFeedsBackendDataSource
            .update(id, {
              attributes: {
                content_md: data.content_md,
                position: data.position,
                annotation_id: data.annotation_id,
              },
            })
            .then(
              (v) => resolve(parseNoteFeedRecordToINoteFeed(v.data)),
              (v) => reject(v.error),
            );
        });
      },
      delete(id: string) {
        return new Promise<void>((resolve, reject) => {
          noteCommentsBackendDataSource
            .list({
              fields: {
                [NoteCommentRecord.type]: ["id"],
              },
            })
            .then(async (res) => {
              res.data.forEach(async (comment) => {
                await noteCommentsBackendDataSource.delete(comment.id);
              });

              await noteFeedsBackendDataSource.delete(id);
            })
            .then(
              () => resolve(),
              (v) => reject(v.error),
            );
        });
      },
      markAsResolved(noteFeedId: string) {
        return new Promise<INoteFeed>((resolve, reject) => {
          noteFeedsBackendDataSource.markAsResolved(noteFeedId).then(
            (v) => resolve(parseNoteFeedRecordToINoteFeed(v.data)),
            (v) => reject(v.error),
          );
        });
      },
    },

    /** NOTE::COMMENTS */
    comments: {
      list(listOptions: IListOptions): Promise<Array<INoteComment>> {
        return new Promise<Array<INoteComment>>((resolve, reject) => {
          noteCommentsBackendDataSource
            .list({
              filters: { ...listOptions.filters },
              pagination: listOptions.pagination,
              sort: listOptions.sort,
            })
            .then(
              (v) => resolve(v.data.map((note) => parseNoteCommentRecordToINoteComment(note))),
              (v) => reject(v.error),
            );
        });
      },
      create(data: Partial<INoteComment>) {
        const { note_feed_id, content_md } = data;
        return new Promise<INoteComment>((resolve, reject) => {
          noteCommentsBackendDataSource
            .create({
              attributes: {
                note_feed_id,
                content_md,
              },
              relationships: {
                note_feed: {
                  data: {
                    id: note_feed_id!,
                    type: "dataset:note_feeds",
                  },
                },
              },
            })
            .then(
              (v) => resolve(parseNoteCommentRecordToINoteComment(v.data)),
              (v) => reject(v.error),
            );
        });
      },
      update(id: string, data: Partial<INoteComment>) {
        return new Promise<INoteComment>((resolve, reject) => {
          noteCommentsBackendDataSource
            .update(id, {
              attributes: {
                content_md: data.content_md,
              },
            })
            .then(
              (v) => resolve(parseNoteCommentRecordToINoteComment(v.data)),
              (v) => reject(v.error),
            );
        });
      },
      delete(id: string) {
        return new Promise<void>((resolve, reject) => {
          noteCommentsBackendDataSource.delete(id).then(
            () => resolve(),
            (v) => reject(v.error),
          );
        });
      },
    },
  };
}
