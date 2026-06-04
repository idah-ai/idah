<script lang="ts">
  import TrackBlockContextMenu from "$lib/components/App/Timeline/annotations/_TrackBlockContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { notes } from "$lib/state/data.svelte";
  import { data } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import type { IVideoAnnotationShape } from "$lib/types";
  import { centroid as centroidUtil } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";

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
      return notes.list
        .filter(n =>
          n.anchor.anchor_type === "annotation" &&
          n.anchor.annotation_id === annotation.id
        )
        .map(n => {
          const pos = n.anchor.position as { frame?: number } | undefined;
          return pos?.frame ?? annotation.shape.start;
        })
        .sort((a, b) => a - b);
    }
    // In editor workspace, show annotation keyframes
    return annotation.shape.frames.map((f) => f.frame);
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

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();

    // In review workspace, clicking a keyframe selects the corresponding note
    if (viewport.isReviewWorkspace) {
      const note = notes.list.find(n => {
        if (n.anchor.anchor_type !== "annotation" || n.anchor.annotation_id !== annotation.id) return false;
        const pos = n.anchor.position as { frame?: number } | undefined;
        return pos?.frame === keyframe;
      });
      if (note) {
        const driver = getDriver();

        // Jump to the note's saved frame
        const naPos = note.anchor.position as { frame?: number } | undefined;
        if (naPos?.frame !== undefined) viewport.video.currentFrame.value = naPos.frame;

        // Focus the annotation if anchored to one (same as onFocusNote in NoteMarkers)
        if (note.anchor.anchor_type === "annotation" && note.anchor.annotation_id) {
          const ann = data.annotations?.items?.find(a => a.id === note.anchor.annotation_id);
          if (ann) {
            selection.selectAnnotation(ann);
            driver.command.call("selection.center");
          }
        } else {
          viewport.workspace.fitToViewport();
        }

        // Select the note — NoteMarkers handles popup positioning via its $effect
        driver.notes.selectNote(note.id);
        return;
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
  oncontextmenu={handleOnContextMenu}
>
  <!-- KEYFRAMES -->
  {#each keyframes as keyframe (keyframe)}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] rounded-sm focus:outline-none"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={color}
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}

  <!-- Visual padding layer (does not affect keyframe positioning) -->
  <div class="pointer-events-none absolute inset-0 rounded-lg p-2"></div>
</button>
