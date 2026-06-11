<script lang="ts">
  import NoteCard from "@/plugin/layout/sidebar/notes/cards/note-card.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
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
      const updatedNoteCommentRes = await noteCommentsBackendDataSource.update(
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
      noteCommentRecord = updatedNoteCommentRes.data;

      $refetches.noteComments.list = new Date();
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteNoteComment() {
    try {
      await noteCommentsBackendDataSource.delete(id, { showErrorToast: false });

      $refetches.noteComments.list = new Date();
    } catch (error) {
      console.log(error);
    }
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
