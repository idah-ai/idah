<script lang="ts">
  import { notes, activeNoteId, focusNote, pendingNoteScene } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
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

  // Unique sorted keyframe values, plus pending note frame when applicable
  let keyframes = $derived.by(() => {
    const existing = new Set(entryNotes.map((n) => (n.anchor.position as { frame: number }).frame));
    // Add pending entry-level note frame as a ghost keyframe marker
    const p = pendingNoteScene.value;
    if (p?.type === "entry") {
      existing.add(p.frame);
    }
    return [...existing].sort((a, b) => a - b);
  });

  const rangeSize = $derived(Number(endRange - startRange) + 1);

  function isPendingFrame(keyframe: number): boolean {
    const p = pendingNoteScene.value;
    return p?.type === "entry" && p.frame === keyframe;
  }

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    // Don't navigate to a pending (ghost) keyframe with no real note
    if (isPendingFrame(keyframe)) return;

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
      class="absolute translate-x-[5%] rounded-sm focus:outline-none"
      class:cursor-pointer={!isPendingFrame(keyframe)}
      class:opacity-60={isPendingFrame(keyframe)}
      class:bg-primary={!isPendingFrame(keyframe)}
      class:bg-muted-foreground={isPendingFrame(keyframe)}
      style:top="3px"
      style:height="calc(100% - {3 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      oncontextmenu={(e) => handleKeyframeContextMenu(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}
</div>
