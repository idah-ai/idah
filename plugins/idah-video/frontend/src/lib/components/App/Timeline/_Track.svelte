<script lang="ts">
  import TrackItem from "$lib/components/App/Timeline/_TrackItem.svelte";
  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
  import { isInViewport } from "$lib/components/App/Timeline/utils";
  import { cn } from "$lib/utils";

  import type { TimelineItem, Viewport } from "$lib/components/App/Timeline/types";

  interface Props {
    viewport: Viewport;
    items: TimelineItem[];
    scale: number;
    top: number;
    isSelected: boolean;
    /** Pass along the track's group id so the track-background context menu can use it. */
    trackId?: string;
  }

  let { viewport, items, scale, top, isSelected, trackId }: Props = $props();

  // Only render items visible in the viewport
  const visibleItems = $derived(
    items.filter((item) => isInViewport(item.startRange, item.endRange, viewport.startRange, viewport.endRange)),
  );

  // ── Right-click on empty track area ───────────────────────────────────

  import { selection } from "$lib/state/selection.svelte";

  function handleContextMenu(e: MouseEvent) {
    // Only handle clicks directly on the track div (not on children — TrackItem blocks handle their own)
    if ((e.target as HTMLElement) !== e.currentTarget) return;
    e.preventDefault();

    // Compute the frame under the cursor.
    // The track element sits inside the content (position: absolute, left: 0).
    // Its getBoundingClientRect().left is the content's left edge in viewport coords,
    // so clientX - rect.left is the pixel offset within the content.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const frame = Math.floor(relX / scale);

    if (trackId) {
      const contextMenuProps: ContextMenuComponentProps = {
        item: undefined,
        trackId,
        frame,
        items: items as any,
      };

      /** Select annotation group */
      selection.selectGroup(trackId);

      showContextMenu(TrackInfoContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
    }
  }

  // ── Click on track background → select the group ──────────────────────

  function handleTrackClick(e: MouseEvent) {
    // Only for clicks directly on the track div (not on TrackItem children)
    if ((e.target as HTMLElement) !== e.currentTarget) return;
    if (trackId) {
      selection.selectGroup(trackId);
    }
  }
</script>

<div
  class={cn("track border-b", {
    "border-primary bg-primary/10 border-t border-b": isSelected,
  })}
  style:height="{TRACK_HEIGHT}px"
  style="top: {top}px;"
  onclick={handleTrackClick}
  oncontextmenu={handleContextMenu}
>
  {#each visibleItems as item, itemIndex (itemIndex)}
    <TrackItem {item} {scale} />
  {/each}
</div>

<style>
  .track {
    position: absolute;
    left: 0;
    right: 0;
    box-sizing: border-box;
  }
</style>
