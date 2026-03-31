<script lang="ts">
  import { totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    getFrameRange,
    setCurrentFrameRange,
    timelineCellWidth,
    timelineRulerWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Props
  interface Props {
    onSelectFrameX: (frameX: number) => void;
  }
  let { onSelectFrameX }: Props = $props();

  // Variables
  let rulerScale = $derived<number>(Math.floor($timelineRulerWidth / $timelineCellWidth));
  let frameRanges = $derived(getFrameRange($currentFrameRange[0], $currentFrameRange[1]));
  let majorTicks = $derived.by<Array<number>>(() => {
    return Array.from({ length: rulerScale })
      .map((_tick, tickIndex) => (tickIndex % $framePerScale === 0 ? tickIndex : null))
      .filter((tick) => tick !== null);
  });

  // Lifecycle
  $effect(() => {
    /** Set current frame range every time ruler scale changes */
    setCurrentFrameRange([0, rulerScale]);
  });

  // Functions
  function selectFrameX(e: MouseEvent) {
    onSelectFrameX(e.clientX);
  }
</script>

<button
  bind:clientWidth={$timelineRulerWidth}
  id="timeline-ruler"
  class="relative w-full border-0 focus:outline-none"
  onclick={selectFrameX}
>
  {#each frameRanges as frame, frameIndex (frameIndex)}
    {@const isMajorTick = majorTicks.includes(frameIndex)}
    {@const frameNumber = (frame + 1) * $framePerScale}
    {@const isInRangeOfTotalFrames = frameIndex * $framePerScale <= $totalFrames - 1}

    {#if isInRangeOfTotalFrames}
      <div
        class="absolute bottom-0 flex items-center border-l pl-0.5 text-sm select-none first:border-l-0"
        style:height="{isMajorTick ? 28 : 14}px"
        style:width="{$timelineCellWidth}px"
        style:left="{frameIndex * $timelineCellWidth}px"
        style:z-index={isMajorTick ? 40 : 0}
      >
        {#if isMajorTick}
          <p class="text-muted-foreground">{frameNumber}</p>
        {/if}
      </div>
    {/if}
  {/each}
</button>
