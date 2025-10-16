import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";

import type { IListOptions, INoteDriver, INoteFeed } from "@/plugin/interface/Activity";

export function createNoteDriver(entryId: string): INoteDriver {
  return {
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
            (v) =>
              resolve(
                // Transform NoteFeedRecord to INoteFeed
                {
                  id: v.data.id,
                  entry_id: v.data.entry_id,
                  annotation_id: v.data.annotation_id,
                  created_by_id: v.data.created_by_id,
                  anchor_type: v.data.anchor_type,
                  position: v.data.position,
                  status: v.data.status,
                  content_md: v.data.content_md,
                  created_at: new Date(v.data.created_at).toString(),
                  updated_at: new Date(v.data.updated_at).toString(),
                },
              ),
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
          })
          .then(
            (v) =>
              resolve(
                v.data.map(
                  (note) =>
                    ({
                      id: note.id,
                      entry_id: note.entry_id,
                      annotation_id: note.annotation_id,
                      created_by_id: note.created_by_id,
                      anchor_type: note.anchor_type,
                      position: note.position,
                      status: note.status,
                      content_md: note.content_md,
                      created_at: new Date(note.created_at).toString(),
                      updated_at: new Date(note.updated_at).toString(),
                    }) as INoteFeed,
                ),
              ),
            (v) => reject(v.error),
          );
      });
    },
    markAsResolved(noteFeedId: string) {
      return new Promise<INoteFeed>((resolve, reject) => {
        noteFeedsBackendDataSource.markAsResolved(noteFeedId).then(
          (v) =>
            resolve({
              id: v.data.id,
              entry_id: v.data.entry_id,
              annotation_id: v.data.annotation_id,
              created_by_id: v.data.created_by_id,
              anchor_type: v.data.anchor_type,
              position: v.data.position,
              status: v.data.status,
              content_md: v.data.content_md,
              created_at: new Date(v.data.created_at).toString(),
              updated_at: new Date(v.data.updated_at).toString(),
            }),
          (v) => reject(v.error),
        );
      });
    },
  };
}
