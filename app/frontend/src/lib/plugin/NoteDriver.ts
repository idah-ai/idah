import { NoteCommentRecord } from "@/data/model/dataset/notes/comments/record";
import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";

import type { INoteComment, INoteFeed, INotes } from "@/plugin/interface/Activity";

export function parseNoteFeedRecordToINoteFeed(record: NoteFeedRecord): INoteFeed {
  return {
    id: record.id,
    entry_id: record.entry_id,
    annotation_id: record.annotation_id,
    created_by_email: record.created_by_email,
    anchor_type: record.anchor_type,
    position: record.position,
    status: record.status,
    content_md: record.content_md,
    created_at: new Date(record.created_at).toString(),
    updated_at: new Date(record.updated_at).toString(),
    edited_at: record.edited_at ? new Date(record.edited_at).toString() : null,
  };
}

export function parseNoteCommentRecordToINoteComment(record: NoteCommentRecord): INoteComment {
  return {
    id: record.id,
    note_feed_id: record.note_feed_id,
    is_edited: record.is_edited,
    content_md: record.content_md,
    created_by_email: record.created_by_email,
    created_at: new Date(record.created_at).toString(),
    updated_at: new Date(record.updated_at).toString(),
    edited_at: record.edited_at ? new Date(record.edited_at).toString() : null,
  };
}

export function createNoteDriver(): INotes {
  let _onNoteSelected: ((noteFeedId: string | null, noteCommentId?: string) => void) | undefined;
  let _onNewNoteFeedOpenChange:
    | ((data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => void)
    | undefined;
  let _onRequireNoteFeedPosition: ((noteFeed: INoteFeed) => void) | undefined;

  return {
    showNewNoteFeedPopup: (data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => {
      _onNewNoteFeedOpenChange?.(data);
    },
    onNewNoteFeedOpenChange: (cb) => (_onNewNoteFeedOpenChange = cb),

    requireNoteFeedPosition: (noteFeed: INoteFeed) => {
      _onRequireNoteFeedPosition?.(noteFeed);
    },
    onRequireNoteFeedPosition: (cb) => (_onRequireNoteFeedPosition = cb),

    gotoFeed: (noteFeedId: string | null, noteCommentId?: string) => {
      _onNoteSelected?.(noteFeedId, noteCommentId);
    },
    onNoteSelected: (cb) => (_onNoteSelected = cb),
  };
}
