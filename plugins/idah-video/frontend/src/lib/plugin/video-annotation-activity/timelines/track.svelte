<script lang="ts">
  import TrackItem from "$lib/plugin/video-annotation-activity/timelines/track-item.svelte";

  import { isInViewport } from "$lib/plugin/video-annotation-activity/timelines/utils";

  import type { TimelineItem, Viewport } from "$lib/plugin/video-annotation-activity/timelines/types";

  interface Props {
    viewport: Viewport;
    items: TimelineItem[];
    scale: number;
    top: number;
  }

  let { viewport, items, scale, top }: Props = $props();

  // Only render items visible in the viewport
  const visibleItems = $derived(
    items.filter((item) => isInViewport(item.startRange, item.endRange, viewport.startRange, viewport.endRange)),
  );
</script>

<div class="track border-b" style="top: {top}px;">
  {#each visibleItems as item, itemIndex (itemIndex)}
    <TrackItem {item} {scale} />
  {/each}
</div>

<style>
  .track {
    position: absolute;
    left: 0;
    right: 0;
    height: 50px;
    box-sizing: border-box;
  }
</style>
