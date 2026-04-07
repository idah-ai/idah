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

  // Variables::Current Frames Ranges
  let startFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[0]);
  let endFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[1]);
  let middleFrameIndexOfCurrentFrameRange = $derived(
    Math.floor((startFrameIndexOfCurrentFrameRange + endFrameIndexOfCurrentFrameRange) / 2),
  );

  // Variables::Timeline Ruler
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
       * If current frame is out of current frame range
       * If current frame is at the middle of current frame range,
       * - shift the current frame range to the right by 1
       *
       * If current frame is greater than the middle of current frame range,
       * - shift the current frame range to the right by 1, until current frame is at the middle
       */
      if ($currentFrame === middleFrameIndexOfCurrentFrameRange) {
        const newStart = startFrameIndexOfCurrentFrameRange + 1;
        const newEnd = endFrameIndexOfCurrentFrameRange + 1;
        setCurrentFrameRange([newStart, newEnd]);
      } else if ($currentFrame > middleFrameIndexOfCurrentFrameRange) {
        const newStart = startFrameIndexOfCurrentFrameRange + 1;
        const newEnd = endFrameIndexOfCurrentFrameRange + 1;
        setCurrentFrameRange([newStart, newEnd]);
      }
    } else {
      /**
       * Set selected frame x to current frame when video is not playing, but shortcut is pressed (ArrowRight/ArrowLeft)
       * This make timeline-vertical-line change every time current frame is changed.
       */
      const mouseX = getSelectedFrameXFromCurrentFrame({ currentFrame: $currentFrame });
      setSelectedFrameX(mouseX);

      /**
       * To set current frame range when shortcut is pressed (Arrow Left / Arrow Right)
       * Please add your logic on shortcut.ts
       */
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
    {@const frameNumber = Number(frame * $framePerScale) + 1}
    {@const isInRangeOfTotalFrames = frameIndex * $framePerScale <= $totalFrames - 1}

    {#if isInRangeOfTotalFrames}
      <div
        class="absolute bottom-0 flex border-l pl-0.5 text-sm select-none first:border-l-0"
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
