<script lang="ts">
  // Props
  interface Props {
    timelineCellWidth: number;
  }
  let { timelineCellWidth }: Props = $props();

  // Variables
  /** totalFrames = timelineRulerWidth / timelineCellWidth */
  let timelineRulerWidth: number = $state(0);
  let totalFrames: number = $derived(timelineRulerWidth / timelineCellWidth);
</script>

<div bind:clientWidth={timelineRulerWidth} id="timeline-ruler" class="relative w-full">
  {#each Array.from({ length: totalFrames }) as _, frameIndex (frameIndex)}
    <div
      class="absolute bottom-0 flex h-7 items-center border-r pl-1 text-sm select-none"
      style:width="{timelineCellWidth}px"
      style:left="{frameIndex * timelineCellWidth}px"
    >
      <p class="text-muted-foreground">{frameIndex + 1}</p>
    </div>
  {/each}
</div>
