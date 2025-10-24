<script lang="ts">
  import NoteCard from "./note-card.svelte";

  import type { INoteComment } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteComment: INoteComment;
  }
  let { noteComment }: Props = $props();
</script>

<NoteCard record={noteComment} resource="dataset:note_comments"></NoteCard>
