<script lang="ts">
  import TimelineAnnotationCell from "./timeline-annotation-cell.svelte";

  import type { AnnotationGroup } from "@/context/AnnotationContext";
  import type { AnnotationObject } from "../data/annotations";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<AnnotationObject>;
    timelineCellWidth: number;
  }
  let { annotationGroup, timelineCellWidth }: Props = $props();

  // Variables
  let timelineRulerWidth: number = $state(0);

  let annotationFrameRanges: Array<number[]> = $derived(
    annotationGroup.annotations.map((ann) =>
      (ann.shape.frames as { frame: number }[]).map((frame) => frame.frame).sort((a, b) => a - b),
    ),
  );
</script>

<div id="timeline-cells" bind:clientWidth={timelineRulerWidth} class="relative w-full">
  {#each annotationFrameRanges as frameRanges (frameRanges)}
    <TimelineAnnotationCell {frameRanges} {timelineCellWidth} />
  {/each}
</div>
