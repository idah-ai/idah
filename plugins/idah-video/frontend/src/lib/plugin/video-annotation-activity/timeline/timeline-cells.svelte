<script lang="ts">
  import TimelineAnnotationCell from "$lib/plugin/video-annotation-activity/timeline/timeline-annotation-cell.svelte";

  import { getAnnotationGroupFrameRanges } from "$lib/plugin/video-annotation-activity/timeline/utils";

  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
  }
  let { annotationGroup }: Props = $props();

  // Variables
  let timelineRulerWidth: number = $state(0);
  let annotationFrameRanges: Array<number[]> = $derived(getAnnotationGroupFrameRanges({ annotationGroup }));
</script>

<!-- NOTE:: 
  - This component is for rendering annotations boundary only
  - If you need to add more interactive features like onclick, oncontextmenu, etc.
  - Add it to TimelineRowGroup.svelte component instead.
  - As clicking on row group will have all context (annotationGroup, clientX, frame, etc.)
-->
<div id="timeline-cells" bind:clientWidth={timelineRulerWidth} class="relative w-full">
  {#each annotationFrameRanges as frameRanges (frameRanges)}
    <TimelineAnnotationCell {annotationGroup} {frameRanges} />
  {/each}
</div>
