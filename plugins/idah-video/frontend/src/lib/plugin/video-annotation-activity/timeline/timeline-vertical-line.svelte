<script lang="ts">
  import { totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    TIMELINE_ROW_HEADER_WIDTH,
  } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { getFrameFromMouseX } from "$lib/plugin/video-annotation-activity/timeline/utils";
  import { cn } from "$lib/utils";

  // Props
  interface Props {
    positionX: number;
    color?: "default" | "primary";
  }
  let { positionX, color = "default" }: Props = $props();

  // Variables
  let [startFrameIndexOfCurrentFrameRange, _] = $derived($currentFrameRange);
  let scaledFrame = $derived(getFrameFromMouseX({ clientX: positionX }));
  let isFrameInRangeOfTotalFrames = $derived(scaledFrame <= $totalFrames);
  let scaledStartFrameIndexOfCurrentFrameRange = $derived(
    startFrameIndexOfCurrentFrameRange > 1
      ? startFrameIndexOfCurrentFrameRange * $framePerScale
      : startFrameIndexOfCurrentFrameRange * $framePerScale,
  );
  let visible = $derived(positionX > TIMELINE_ROW_HEADER_WIDTH);

  let colorClass = $derived.by(() => {
    switch (color) {
      case "primary": {
        return "bg-primary text-primary-foreground";
      }
      default: {
        return "bg-foreground text-background";
      }
    }
  });
</script>

<!-- HIGHLIGHTED FRAME LABEL -->
{#if isFrameInRangeOfTotalFrames && visible}
  <div
    class={cn(
      "pointer-events-none absolute top-[9px] z-50 min-w-6 -translate-x-1/2 rounded-md px-2 py-1 text-center text-xs font-medium",
      colorClass,
    )}
    style="transform: translateX({positionX}px)"
  >
    {scaledFrame + scaledStartFrameIndexOfCurrentFrameRange}

    <div class={cn("absolute top-full left-1/2 -mt-1 size-1.5 -translate-x-1/2 rotate-45", colorClass)}></div>
  </div>

  <!-- VERTICAL LINE -->
  <div class={cn("cursor-line", colorClass)} style="transform: translateX({positionX}px)"></div>
{/if}

<style>
  .cursor-line {
    position: absolute;
    top: 9px;
    bottom: 0;
    width: 2px;
    pointer-events: none;
  }
</style>
