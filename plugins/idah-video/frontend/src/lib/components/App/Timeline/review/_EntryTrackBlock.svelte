<script lang="ts">
  import { notes, activeNoteId } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { showContextMenu, type ContextMenuComponent } from "$lib/components/App/ContextMenu/store";
  import NoteKeyframeContextMenu from "$lib/components/App/Timeline/review/_NoteKeyframeContextMenu.svelte";
  import type { TimelineItem } from "$lib/components/App/Timeline/types";
  import type { INoteRecord } from "$idah/v2/types";

  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  let { startRange, endRange } = $derived(item);

  // Collect all entry-level notes with frame positions, sorted
  let entryNotes = $derived(item.rawData as INoteRecord[]);

  // Unique sorted keyframe values
  let keyframes = $derived([...new Set(entryNotes.map((n) => (n.anchor.position as { frame: number }).frame))]);

  const rangeSize = $derived(Number(endRange - startRange) + 1);

  function focusNote(note: INoteRecord): void {
    const driver = getDriver();
    const pos = note.anchor.position as { frame?: number; x?: number; y?: number } | undefined;
    if (pos?.frame !== undefined) viewport.video.currentFrame.value = pos.frame;
    viewport.workspace.fitToViewport();

    activeNoteId.value = note.id;
    driver.notes.selectNote(note.id);
  }

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    const notesAtFrame = entryNotes.filter((n) => (n.anchor.position as { frame: number }).frame === keyframe);
    if (notesAtFrame.length > 1) {
      // Cycle
      const currentIndex = notesAtFrame.findIndex((n) => n.id === activeNoteId.value);
      const nextIndex = (currentIndex + 1) % notesAtFrame.length;
      focusNote(notesAtFrame[nextIndex]);
    } else if (notesAtFrame.length === 1) {
      focusNote(notesAtFrame[0]);
    }
  }

  function handleKeyframeContextMenu(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    const notesAtFrame = entryNotes.filter((n) => (n.anchor.position as { frame: number }).frame === keyframe);
    if (notesAtFrame.length > 1) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      showContextMenu(
        NoteKeyframeContextMenu as unknown as ContextMenuComponent,
        { annotationId: "__entry_notes__", annotationStart: 0, frame: keyframe },
        e.clientX,
        rect.bottom,
      );
    }
  }
</script>

<div
  class="relative h-full w-full bg-transparent"
>
  {#each keyframes as keyframe, idx (`${keyframe}-${idx}`)}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] rounded-sm focus:outline-none cursor-pointer bg-primary"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      oncontextmenu={(e) => handleKeyframeContextMenu(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}
</div>
