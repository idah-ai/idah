<script lang="ts">
  import TrackItem from "$lib/plugin/video-annotation-activity/components/Timeline/_TrackItem.svelte";

  import { TRACK_HEIGHT } from "$lib/plugin/video-annotation-activity/components/Timeline/constants";
  import { isInViewport } from "$lib/plugin/video-annotation-activity/components/Timeline/utils";
  import { cn } from "$lib/utils";

  import type { TimelineItem, Viewport } from "$lib/plugin/video-annotation-activity/components/Timeline/types";

  interface Props {
    viewport: Viewport;
    items: TimelineItem[];
    scale: number;
    top: number;
    isSelected: boolean;
  }

  let { viewport, items, scale, top, isSelected }: Props = $props();

  // Only render items visible in the viewport
  const visibleItems = $derived(
    items.filter((item) => isInViewport(item.startRange, item.endRange, viewport.startRange, viewport.endRange)),
  );
</script>

<div
  class={cn("track border-b", {
    "border-primary bg-primary/10 border-t border-b": isSelected,
  })}
  style:height="{TRACK_HEIGHT}px"
  style="top: {top}px;"
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
