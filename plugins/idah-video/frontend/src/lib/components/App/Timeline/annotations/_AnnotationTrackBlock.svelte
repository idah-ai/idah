<script lang="ts">
  import TrackBlockContextMenu from "$lib/components/App/Timeline/annotations/_TrackBlockContextMenu.svelte";
  import NoteKeyframeContextMenu from "$lib/components/App/Timeline/review/_NoteKeyframeContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { notes, activeNoteId, data, focusNote, pendingNoteScene } from "$lib/state/data.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import type { IVideoAnnotationRecord } from "$lib/types";
  import type { INoteRecord } from "$idah/v2/types";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  // Variables
  let { trackId, startRange, endRange, rawData: annotation } = $derived(item);

  const rangeSize = $derived(Number(endRange - startRange) + 1);
  const keyframes = $derived.by(() => {
    if (viewport.isReviewWorkspace) {
      // In review workspace, show note anchor frames as keyframes
      const result = new Set(
        notes.list
          .filter(n =>
            n.anchor.anchor_type === "annotation" &&
            n.anchor.annotation_id === annotation.id
          )
          .map(n => {
            const pos = n.anchor.position as { frame?: number } | undefined;
            return pos?.frame ?? annotation.shape.start;
          })
      );
      // Add pending annotation-anchored note frame as a ghost keyframe
      const p = pendingNoteScene.value;
      if (p?.type === "annotation" && p.annotationId === annotation.id) {
        result.add(p.frame);
      }
      return [...result].sort((a, b) => a - b);
    }
    // In editor workspace, show annotation keyframes
    return annotation.shape.frames.map((f: { frame: number }) => f.frame);
  });

  // Compute color using the same annotationColor() as the viewport shapes
  let color = $derived.by(() => resolveAnnotationColor(annotation));

  // Check if this specific annotation is the selected one
  let isSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "annotation" && v.annotation.id === annotation.id;
  });

  // Functions
  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();

    // Compute the frame under the cursor from the mouse position within the block
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const rangeSpan = endRange - startRange + 1;
    const hoverFrame = Math.min(endRange, Math.floor(startRange + (relX / rect.width) * rangeSpan));

    const contextMenuProps: ContextMenuComponentProps = {
      item,
      currentFrame: hoverFrame,
    };

    /* Select annotation */
    selection.selectAnnotation(annotation);

    showContextMenu(TrackBlockContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }

  function handleAnnotationClick(e: MouseEvent) {
    e.preventDefault();
    selection.selectAnnotation(annotation);
  }

  function handleKeyframeContextMenu(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    if (viewport.isReviewWorkspace) {
      // In review mode — show note selection menu
      const notesAtFrame = notes.list.filter(n => {
        if (n.anchor.anchor_type !== "annotation" || n.anchor.annotation_id !== annotation.id) return false;
        const pos = n.anchor.position as { frame?: number } | undefined;
        return pos?.frame === keyframe;
      });
      if (notesAtFrame.length > 1) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        showContextMenu(
          NoteKeyframeContextMenu as unknown as ContextMenuComponent,
          { annotationId: annotation.id, annotationStart: annotation.shape.start, frame: keyframe },
          e.clientX,
          rect.bottom,
        );
      }
      return;
    }
    // Editor mode — show annotation menu
    handleOnContextMenu(e);
  }

  function isPendingFrame(keyframe: number): boolean {
    const p = pendingNoteScene.value;
    return p?.type === "annotation" && p.annotationId === annotation.id && p.frame === keyframe;
  }

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();

    // Don't navigate to a pending (ghost) keyframe with no real note
    if (isPendingFrame(keyframe)) return;

    // In review workspace, clicking a keyframe selects the corresponding note
    if (viewport.isReviewWorkspace) {
      const notesAtFrame = notes.list.filter(n => {
        if (n.anchor.anchor_type !== "annotation" || n.anchor.annotation_id !== annotation.id) return false;
        const pos = n.anchor.position as { frame?: number } | undefined;
        return pos?.frame === keyframe;
      });

      let note: INoteRecord | undefined;
      if (notesAtFrame.length >= 1) {
        // Multiple notes — cycle to the next one
        const currentIndex = notesAtFrame.findIndex(n => n.id === activeNoteId.value);
        const nextIndex = (currentIndex + 1) % notesAtFrame.length;
        note = notesAtFrame[nextIndex];
      } else {
        note = notesAtFrame[0];
      }

      if (note) {
        focusNote(note);
      }
    }

    viewport.video.currentFrame.value = keyframe;
  }
</script>

<button
  class="relative h-full w-full cursor-pointer rounded-lg border transition-opacity hover:opacity-80 focus:outline-none"
  class:ring-2={isSelected}
  class:ring-offset-1={isSelected}
  style:background-color={color + "30"}
  style:border-color={color}
  style:--tw-ring-color={isSelected ? color : "transparent"}
  onclick={handleAnnotationClick}
  oncontextmenu={(e) => { e.preventDefault(); viewport.isReviewWorkspace ? null : handleOnContextMenu(e); }}
>
  <!-- KEYFRAMES -->
  {#each keyframes as keyframe, idx (`${keyframe}-${idx}`)}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] rounded-sm focus:outline-none"
      class:opacity-50={isPendingFrame(keyframe)}
      class:cursor-pointer={!isPendingFrame(keyframe)}
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={isPendingFrame(keyframe) ? 'var(--muted-foreground)' : color}
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      oncontextmenu={(e) => handleKeyframeContextMenu(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}

  <!-- Visual padding layer (does not affect keyframe positioning) -->
  <div class="pointer-events-none absolute inset-0 rounded-lg p-2"></div>
</button>
