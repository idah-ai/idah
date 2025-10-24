<script lang="ts">
  import NoteCard from "./note-card.svelte";

  import type { INoteComment } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteComment: INoteComment;
  }
  let { noteComment }: Props = $props();

  // Variables
  let { id, content_md, is_edited, created_by_id, created_at } = $derived(noteComment);
</script>

<NoteCard resource="noteComment" {id} {content_md} {is_edited} {created_by_id} {created_at}></NoteCard>
