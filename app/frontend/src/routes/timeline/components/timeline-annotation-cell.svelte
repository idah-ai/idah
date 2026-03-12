<script lang="ts">
  import { cn } from "@/utils";

  // Props
  interface Props {
    frameRanges: number[];
    timelineCellWidth: number;
  }
  let { frameRanges, timelineCellWidth }: Props = $props();

  // Variables
  let paddingX = $derived(timelineCellWidth >= 30 ? 8 : 4);
  const annotationHeight = 24;

  let rangeLength = $derived(frameRanges.length);
  let startOfRange = $derived(frameRanges[0]);
  let endOfRange = $derived(frameRanges[rangeLength - 1]);
  let rangeWidth = $derived((endOfRange - (startOfRange - 1)) * timelineCellWidth);
</script>

<!-- ANNOTATION GROUP -->
<div
  id="timeline-annotation-cell"
  class="hover:bg-primary/30 bg-primary/10 absolute translate-x-1 -translate-y-[50%] rounded-sm"
  style:width="{rangeWidth - paddingX}px"
  style:height="{annotationHeight}px"
  style:left="{Math.abs(startOfRange - 1) * timelineCellWidth}px"
></div>

<!-- ANNOTATION AT FRAME (INTERPOLATION) -->
{#each frameRanges as interpolationAtFrame, index (interpolationAtFrame)}
  {@const isLastFrameRange = frameRanges.length - 1 === index}
  <div
    class={cn(
      "bg-primary/50 absolute -translate-y-[50%] rounded-sm",
      isLastFrameRange ? "translate-x-8px]" : "translate-x-[8px]",
    )}
    style:height="{annotationHeight * 0.6}px"
    style:width="{timelineCellWidth * 0.7}px"
    style:left="{(interpolationAtFrame - 1) * timelineCellWidth}px"
  ></div>
{/each}
