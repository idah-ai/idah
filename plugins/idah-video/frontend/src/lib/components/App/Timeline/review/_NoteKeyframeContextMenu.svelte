<script lang="ts">
  import { notes, focusNote } from "$lib/state/data.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";

  import type { ContextMenuComponentProps } from "$lib/components/App/ContextMenu/store";
  import type { INoteRecord } from "$idah/v2/types";

  interface Props extends ContextMenuComponentProps {
    annotationId: string;
    annotationStart: number;
    frame: number;
  }
  let { annotationId, annotationStart, frame }: Props = $props();

  // Find all notes anchored to this annotation/entry at this frame
  let matchingNotes = $derived(
    notes.list.filter((n) => {
      if (n.anchor.anchor_type === "annotation") {
        if (n.anchor.annotation_id !== annotationId) return false;
      } else if (n.anchor.anchor_type === "entry") {
        // For entry-level notes, annotationId is "__entry_notes__"
        if (annotationId !== "__entry_notes__") return false;
      } else {
        return false;
      }
      const pos = n.anchor.position as { frame?: number } | undefined;
      return (pos?.frame ?? annotationStart) === frame;
    }),
  );
</script>

<div class="bg-background my-1 flex flex-col">
  <p class="px-3 py-1 text-xs font-semibold text-muted-foreground">Notes at frame {frame}</p>
  {#each matchingNotes as note (note.id)}
    <Button
      variant="ghost"
      size="sm"
      class="mx-1 w-full justify-start"
      onclick={() => focusNote(note)}
    >
      <span class="truncate">{note.content_md ?? "Note"}</span>
    </Button>
  {/each}
</div>
