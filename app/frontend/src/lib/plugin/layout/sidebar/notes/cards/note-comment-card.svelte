<script lang="ts">
  import { toast } from "svelte-sonner";

  import NoteCard from "@/plugin/layout/sidebar/notes/cards/note-card.svelte";

  import { noteCommentsBackendDataSource, type NoteCommentRecord } from "@/data/model/dataset/notes/comments/record";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    noteCommentRecord: NoteCommentRecord;
    highlighted?: boolean;
  }
  let { noteCommentRecord, highlighted = false }: Props = $props();

  // Variables
  let { id, content_md, created_by_email, created_at, edited_at, note_feed_id } = $derived(noteCommentRecord);

  // Functions
  async function updateNoteCommentMd(newContentMd: string) {
    try {
      const updatedNoteCommentRes = await noteCommentsBackendDataSource.update(id, {
        attributes: {
          content_md: newContentMd,
        },
      });
      noteCommentRecord = updatedNoteCommentRes.data;
      toast.success("Comment updated", {
        description: "The note comment has been updated.",
      });
      $refetches.noteComments.list = new Date();
    } catch (error) {
      console.error(error);
      toast.error("You are not authorized to do this action.");
    }
  }

  async function deleteNoteComment() {
    await noteCommentsBackendDataSource.delete(id);
    toast.success("Comment deleted", {
      description: "The note comment has been deleted.",
    });
    $refetches.noteComments.list = new Date();
  }
</script>

<NoteCard
  noteFeedId={note_feed_id}
  noteCommentId={id}
  {content_md}
  {created_by_email}
  {created_at}
  {edited_at}
  editable
  deletable
  {highlighted}
  onUpdateContentMd={updateNoteCommentMd}
  onDelete={deleteNoteComment}
></NoteCard>
