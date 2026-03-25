<script lang="ts">
  import { timelineCellWidth } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Props
  interface Props {
    onSelectFrameX: (frameX: number) => void;
  }
  let { onSelectFrameX }: Props = $props();

  // Variables
  /** totalFrames = timelineRulerWidth / timelineCellWidth */
  let timelineRulerWidth: number = $state(0);
  let totalFrames: number = $derived(Math.round(timelineRulerWidth / $timelineCellWidth));

  /** If total frames greater than timeline cell width,
   * it means that the timeline ruler is not wide enough to display all frames
   * We need to display the frames in chunks
   */
  let scale = $derived(Math.ceil(totalFrames / $timelineCellWidth));

  function selectFrameX(e: MouseEvent) {
    onSelectFrameX(e.clientX);
  }
</script>

<button bind:clientWidth={timelineRulerWidth} id="timeline-ruler" class="relative w-full" onclick={selectFrameX}>
  {#each Array.from({ length: totalFrames }) as _, frameIndex (frameIndex)}
    {@const showFrameNumber = frameIndex % scale === 0}
    {@const frameNumber = frameIndex + 1}
    <div
      class="absolute bottom-0 flex items-center border-l pl-0.5 text-sm select-none first:border-l-0"
      style:height="{showFrameNumber ? 28 : 14}px"
      style:width="{$timelineCellWidth}px"
      style:left="{frameIndex * $timelineCellWidth}px"
    >
      {#if showFrameNumber}
        <p class="text-muted-foreground">{frameNumber}</p>
      {/if}
    </div>
  {/each}
</button>
