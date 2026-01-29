import { SvelteDate } from "svelte/reactivity";

import { showToast } from "@/components/ui/toast/index.svelte";
import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
import { noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
import { refetches } from "@/utils/refetch";

function refetchNoteFeeds() {
  refetches.update((store) => ({
    ...store,
    noteFeeds: {
      ...store.noteFeeds,
      list: new SvelteDate(),
    },
  }));
}

export async function updateNoteFeedContentMd(id: string, newContentMd: string) {
  try {
    const updatedNoteFeedRes = await noteFeedsBackendDataSource.update(
      id,
      {
        attributes: {
          content_md: newContentMd,
        },
      },
      {
        showErrorToast: false,
      },
    );

    refetchNoteFeeds();
    showToast.success({
      title: "Note updated",
      description: "The note has been updated.",
    });

    return updatedNoteFeedRes.data;
  } catch (error) {
    console.error(error);
    showToast.error({ title: "You are not authorized to do this action." });
    return null;
  }
}

export async function deleteNoteFeed(id: string) {
  try {
    const relatedNoteCommentsRes = await noteCommentsBackendDataSource.list({
      fields: {
        [NoteCommentRecord.type]: ["id"],
      },
      filters: {
        note_feed_id: id,
      },
    });

    await new Promise((resolve) => {
      relatedNoteCommentsRes.data.forEach(async (comment) => {
        await noteCommentsBackendDataSource.delete(comment.id, { showErrorToast: false });
        resolve(true);
      });
      if (relatedNoteCommentsRes.data.length === 0) resolve(true);
    });

    await noteFeedsBackendDataSource.delete(id, { showErrorToast: false });

    showToast.success({
      title: "Note deleted",
      description: "The note has been deleted.",
    });
    refetchNoteFeeds();
  } catch (error) {
    console.error(error);
    showToast.error({ title: "You are not authorized to do this action." });
  }
}
