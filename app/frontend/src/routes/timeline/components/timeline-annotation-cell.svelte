<script lang="ts">
  // Props
  interface Props {
    frameRanges: number[];
    timelineCellWidth: number;
  }
  let { frameRanges, timelineCellWidth }: Props = $props();

  // Variables
  const annotationHeight = 24;

  let rangeLength = $derived(frameRanges.length);
  let startOfRange = $derived(frameRanges[0]);
  let endOfRange = $derived(frameRanges[rangeLength - 1]);
  let rangeWidth = $derived((endOfRange - (startOfRange - 1)) * timelineCellWidth);
</script>

<!-- NOTE:: 
  - This component is for rendering annotations / interpolation only
  - If you need to add more interactive features like onclick, oncontextmenu, etc.
  - Add it to TimelineRowGroup.svelte component instead.
  - As clicking on row group will have all context (annotationGroup, clientX, frame, etc.)
-->

<!-- ANNOTATION GROUP -->
<div
  id="timeline-annotation-cell"
  class="hover:bg-primary/30 bg-primary/10 border-primary/50 absolute -translate-y-[50%] rounded-sm border-1"
  style:width="{rangeWidth}px"
  style:height="{annotationHeight}px"
  style:left="{Math.abs(startOfRange - 1) * timelineCellWidth}px"
></div>

<!-- ANNOTATION AT FRAME (INTERPOLATION) -->
{#each frameRanges as interpolationAtFrame (interpolationAtFrame)}
  <div
    class="bg-primary/50 absolute translate-x-[15%] -translate-y-[50%] rounded-sm"
    style:height="{annotationHeight * 0.6}px"
    style:width="{timelineCellWidth * 0.8}px"
    style:left="{(interpolationAtFrame - 1) * timelineCellWidth}px"
  ></div>
{/each}
