<script lang="ts">
  interface Props {
    offset: number;
    length: number;
    scale: number;
    height: number;
    trackLength: number;
    color?: string;
  }

  let { offset, length, scale, height, trackLength, color = "#4a90d9" }: Props = $props();

  // Clamp offset to be within track bounds
  const clampedOffset = $derived(Math.max(0, Math.min(offset, trackLength - 1)));
  // Clamp length so it doesn't exceed track bounds
  const clampedLength = $derived(Math.max(0, Math.min(length, trackLength - clampedOffset)));

  // Calculate pixel position and width
  const left = $derived(clampedOffset * scale);
  const width = $derived(clampedLength * scale);
</script>

<div class="selection" style="left: {left}px; width: {width}px; height: {height}px; background-color: {color};">
  <div class="selection-caret"></div>
</div>

<style>
  .selection {
    position: absolute;
    top: 0;
    pointer-events: none;
    opacity: 0.3;
  }

  .selection-caret {
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 100%;
    background-color: v-bind(color);
    opacity: 1;
  }
</style>
