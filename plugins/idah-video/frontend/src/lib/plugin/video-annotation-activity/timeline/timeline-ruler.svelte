<script lang="ts">
  import { currentFrame, isVideoPlaying, totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    getFrameRange,
    setCurrentFrameRange,
    setSelectedFrameX,
    timelineCellWidth,
    timelineRulerWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { getSelectedFrameXFromCurrentFrame } from "$lib/plugin/video-annotation-activity/timeline/utils";

  // Props
  interface Props {
    onSelectFrameX: (frameX: number) => void;
  }
  let { onSelectFrameX }: Props = $props();

  // Variables
  let startFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[0]);
  let rulerScale = $derived<number>(Math.floor($timelineRulerWidth / $timelineCellWidth));
  let frameRanges = $derived(getFrameRange($currentFrameRange[0], $currentFrameRange[1]));
  let majorTicks = $derived.by<Array<number>>(() => {
    return Array.from({ length: rulerScale })
      .map((_tick, tickIndex) => (tickIndex % $framePerScale === 0 ? tickIndex : null))
      .filter((tick) => tick !== null);
  });

  // Lifecycle
  $effect(() => {
    /**
     * Set current frame range every time ruler scale changes
     * Note: Can't use onMount as we need to wait for the timelineRulerWidth to be set.
     */
    setCurrentFrameRange([0, rulerScale]);
  });

  $effect(() => {
    if ($isVideoPlaying) {
      /**
       * Set selected frame x to current frame when video is playing
       * This make timeline-vertical-line change every time current frame is changed.
       */
      const mouseX = getSelectedFrameXFromCurrentFrame({
        currentFrame: $currentFrame - startFrameIndexOfCurrentFrameRange,
      });
      setSelectedFrameX(mouseX);

      /**
       * If currentFrame is out of current frame range
       * - Shift the current frame range to the right
       */

      /** The last frame index of current frame range (0-based), e.g. [0, 48] will return 48 */
      let endFrameIndexOfCurrentFrameRange = $currentFrameRange[1];
      if ($currentFrame > endFrameIndexOfCurrentFrameRange + 1) {
        const newStart = $currentFrame - Math.floor(rulerScale / 2);
        const newEnd = newStart + rulerScale;
        setCurrentFrameRange([newStart, newEnd]);
      }
    }
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
