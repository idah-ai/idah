<script lang="ts">
  import { notes, activeNoteId } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
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

  function focusNote(note: INoteRecord): void {
    const driver = getDriver();
    const naPos = note.anchor.position as { frame?: number } | undefined;
    if (naPos?.frame !== undefined) viewport.video.currentFrame.value = naPos.frame;

    if (note.anchor.anchor_type === "annotation" && note.anchor.annotation_id) {
      const ann = data.annotations?.items?.find((a) => a.id === note.anchor.annotation_id);
      if (ann) {
        selection.selectAnnotation(ann);
        driver.command.call("selection.center");
      }
    } else {
      viewport.workspace.fitToViewport();
    }

    activeNoteId.value = note.id;
    driver.notes.selectNote(note.id);

    const svgEl = viewport.svgElement;
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const { translate, scale } = viewport.workspace.transform;
      const pos = note.anchor.position as { x?: number; y?: number } | undefined;
      const sx = (pos?.x ?? 0.5) * media.width;
      const sy = (pos?.y ?? 0.5) * media.height;
      const screenX = sx * scale + translate[0] + rect.left;
      const screenY = sy * scale + translate[1] + rect.top;
      driver.notes.reportNotePosition({ noteId: note.id, x: screenX, y: screenY });
    }
  }
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
