<script lang="ts">
  import TimelineAnnotationCell from "$lib/plugin/video-annotation-activity/timeline/timeline-annotation-cell.svelte";

  import { currentFrameRange } from "$lib/plugin/video-annotation-activity/timeline/store";
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

  let filteredAnnotationFrameRangesInCurrentFrameRange = $derived.by(() => {
    const startOfCurrentFrameRange = $currentFrameRange[0];
    const endOfCurrentFrameRange = $currentFrameRange[1];

    return annotationFrameRanges.map((annotationFrameRange) => {
      return annotationFrameRange.filter((frame) => {
        let f: number;
        if (frame >= startOfCurrentFrameRange && frame <= endOfCurrentFrameRange) {
          f = frame;
        } else if (frame >= startOfCurrentFrameRange && frame >= endOfCurrentFrameRange) {
          f = frame;
        } else {
          return;
        }

        return f;
      });
    });
  });

  $inspect(JSON.stringify([annotationFrameRanges, filteredAnnotationFrameRangesInCurrentFrameRange], null, 0));
</script>

<!-- NOTE:: 
  - This component is for rendering annotations boundary only
  - If you need to add more interactive features like onclick, oncontextmenu, etc.
  - Add it to TimelineRowGroup.svelte component instead.
  - As clicking on row group will have all context (annotationGroup, clientX, frame, etc.)
-->
<div id="timeline-cells" bind:clientWidth={timelineRulerWidth} class="relative w-full">
  {#each filteredAnnotationFrameRangesInCurrentFrameRange as frameRanges (frameRanges)}
    <TimelineAnnotationCell {annotationGroup} {frameRanges} />
  {/each}
</div>
