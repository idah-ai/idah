<script lang="ts">
  import { totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    TIMELINE_ROW_HEADER_WIDTH,
    timelineRulerWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Props
  interface Props {
    // onMouseOver: (e: MouseEvent) => void;
  }
  let {}: Props = $props();

  // Variables
  let viewportWidthPx = $derived(window.innerWidth);
  let startFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[0]);
  let endFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[1]);
  let currentRangeSpan = $derived(endFrameIndexOfCurrentFrameRange - startFrameIndexOfCurrentFrameRange);

  let handlePositionX = $derived.by(() => {
    // (startFrameIndexOfCurrentFrameRange * $framePerScale);
    return (startFrameIndexOfCurrentFrameRange / $totalFrames) * $timelineRulerWidth;
  });

  // $inspect($timelineRulerWidth / currentRangeSpan);
</script>

<!-- -->
<div
  role="scrollbar"
  aria-controls="0"
  aria-valuenow={0}
  tabindex="0"
  class="h-5 bg-secondary absolute bottom-0"
  style:width="{$timelineRulerWidth}px"
  style:left="{TIMELINE_ROW_HEADER_WIDTH}px"
  onfocus={() => {}}
  onmouseover={() => {}}
>
  <!-- SCROLL BAR::HANDLE -->
  <button
    aria-label="scrollbar-handle"
    class="rounded-lg bg-gray-300 h-3 absolute bottom-1"
    style:width="{(currentRangeSpan / $totalFrames) * viewportWidthPx}px"
    style:left="{handlePositionX}px"
    onmousemovecapture={() => {}}
  ></button>
</div>
