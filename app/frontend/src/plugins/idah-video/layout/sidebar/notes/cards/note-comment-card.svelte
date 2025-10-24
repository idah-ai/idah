<script lang="ts">
  import NoteCard from "./note-card.svelte";

  import type { INoteComment } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteComment: INoteComment;
    highlighted?: boolean;
  }
  let { noteComment, highlighted }: Props = $props();
</script>

<NoteCard record={noteComment} resource="dataset:note_comments" {highlighted}></NoteCard>
