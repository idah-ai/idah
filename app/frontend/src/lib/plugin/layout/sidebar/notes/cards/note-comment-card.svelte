<script lang="ts">
  import { toast } from "svelte-sonner";

  import NoteCard from "@/plugin/layout/sidebar/notes/cards/note-card.svelte";

  import { noteCommentsBackendDataSource, type NoteCommentRecord } from "@/data/model/dataset/notes/comments/record";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    noteCommentRecord: NoteCommentRecord;
  }
  let { noteCommentRecord }: Props = $props();

  // Variables
  let { id, content_md, created_by_email, created_at, edited_at, note_feed_id } = $derived(noteCommentRecord);

  // Functions
  async function updateNoteCommentMd(newContentMd: string) {
    const updatedNoteCommentRes = await noteCommentsBackendDataSource.update(id, {
      attributes: {
        content_md: newContentMd,
      },
    });
    noteCommentRecord = updatedNoteCommentRes.data;
    toast.success("Note comment updated successfully.");
    $refetches.noteComments.list = new Date();
  }

  async function deleteNoteComment() {
    await noteCommentsBackendDataSource.delete(id);
    toast.success("Note comment deleted successfully.");
    $refetches.noteComments.list = new Date();
  }
</script>

<NoteCard
  noteFeedId={note_feed_id}
  {content_md}
  {created_by_email}
  {created_at}
  {edited_at}
  editable
  deletable
  onUpdateContentMd={updateNoteCommentMd}
  onDelete={deleteNoteComment}
></NoteCard>
