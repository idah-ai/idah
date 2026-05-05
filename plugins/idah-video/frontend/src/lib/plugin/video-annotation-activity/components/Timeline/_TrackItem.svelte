<script lang="ts">
  import type { TimelineItem } from "$lib/plugin/video-annotation-activity/components/Timeline/types";

  interface Props {
    item: TimelineItem;
    scale: number;
  }

  let { item, scale }: Props = $props();

  // Calculate pixel position based on scale (pixels per unit)
  const left = $derived(`${item.startRange * scale}px`);
  const width = $derived(`${(item.endRange - item.startRange + 1) * scale}px`);
  const style = $derived(`left: ${left}; width: ${width};`);

  // Get the component to render
  const Component = $derived(item.component);
</script>

<div class="track-item" {style}>
  <div class="track-item-content">
    <Component {item} />
  </div>
</div>

<style>
  .track-item {
    position: absolute;
    top: 4px;
    height: calc(100% - 8px);
    box-sizing: border-box;
    background-color: transparent;
  }

  .track-item-content {
    width: 100%;
    height: 100%;
  }
</style>
