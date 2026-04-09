<script lang="ts">
  import { totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    setCurrentFrameRange,
    TIMELINE_ROW_HEADER_WIDTH,
    timelineRulerWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Variables
  let isDragging = $state(false);
  let dragOffset = $state(0);
  let [startFrameIndexOfCurrentFrameRange, endFrameIndexOfCurrentFrameRange] = $derived($currentFrameRange);
  let currentRangeSpan = $derived(endFrameIndexOfCurrentFrameRange - startFrameIndexOfCurrentFrameRange);
  let totalCells = $derived(Math.ceil($totalFrames / $framePerScale));

  let handlePositionX = $derived(
    getScrollbarHandlePositionX({ startFrameOfCurrentFrameRange: startFrameIndexOfCurrentFrameRange }),
  );
  let scrollbarHandleWidth = $derived((currentRangeSpan / totalCells) * $timelineRulerWidth);
  let scrollbarMaxWidth = $derived($timelineRulerWidth - scrollbarHandleWidth);

  // Functions
  function getScrollbarHandlePositionX(props: { startFrameOfCurrentFrameRange: number }) {
    const { startFrameOfCurrentFrameRange } = props;

    return (startFrameOfCurrentFrameRange / totalCells) * $timelineRulerWidth;
  }

  function computeCurrentFrameRangeFromMouseX(e: MouseEvent) {
    const mouseX = e.clientX;
    const middleOfScrollbarHandle = scrollbarHandleWidth / 2;
    const timelinePositionX = Math.max(0, mouseX - TIMELINE_ROW_HEADER_WIDTH - middleOfScrollbarHandle);
    const postionXPercent = Math.min(1, timelinePositionX / $timelineRulerWidth);

    const maximumStartFrame = totalCells - currentRangeSpan;
    const startFrame = Math.max(0, Math.min(maximumStartFrame, Math.floor(postionXPercent * totalCells)));
    const endFrame = startFrame + currentRangeSpan;

    setCurrentFrameRange([startFrame, endFrame]);
  }
  function handleWindowMouseMove(e: MouseEvent) {
    if (!isDragging) return;

    const mouseX = e.clientX;
    const timelinePositionX = Math.max(0, mouseX - dragOffset - TIMELINE_ROW_HEADER_WIDTH);
    const postionXPercent = Math.min(1, timelinePositionX / $timelineRulerWidth);

    const maximumStartFrame = totalCells - currentRangeSpan;
    const startFrame = Math.max(0, Math.min(maximumStartFrame, Math.floor(postionXPercent * totalCells)));
    const endFrame = startFrame + currentRangeSpan;

    setCurrentFrameRange([startFrame, endFrame]);
  }

  function handleWindowMouseUp() {
    isDragging = false;
  }
</script>

<svelte:window onmousemove={handleWindowMouseMove} onmouseup={handleWindowMouseUp} />

<div
  role="button"
  tabindex="0"
  class="h-4 bg-secondary absolute bottom-0 border-t opacity-70"
  style:width="{$timelineRulerWidth}px"
  style:left="{TIMELINE_ROW_HEADER_WIDTH}px"
  onkeypress={() => {}}
  onclick={computeCurrentFrameRangeFromMouseX}
>
  <!-- SCROLL BAR::HANDLE -->
  <div class="bg-primary" style:width="{scrollbarMaxWidth}px">
    <button
      aria-label="scrollbar-handle"
      class="rounded-lg bg-gray-300 h-3 absolute bottom-0.5 focus:outline-none"
      style:width="{scrollbarHandleWidth}px"
      style:left="{handlePositionX}px"
      onclick={(e) => e.stopPropagation()}
      onmousedowncapture={(e) => {
        isDragging = true;
        dragOffset = e.clientX - handlePositionX - TIMELINE_ROW_HEADER_WIDTH;
      }}
    ></button>
  </div>
</div>
