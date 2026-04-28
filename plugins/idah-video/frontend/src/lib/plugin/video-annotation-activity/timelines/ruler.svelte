<script lang="ts">
  import type { TimelineRulerProps } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Props
  interface Props extends TimelineRulerProps {
    scale: number;
  }

  let { viewport, rulerMajorStep = 10, rulerMinorStep = 50, rulerLabelFormatter, scale }: Props = $props();

  // Variables
  // Generate all marks (small and big) within the viewport range
  const marks = $derived.by(() => {
    const result: Array<{ position: number; value: number; isMajor: boolean }> = [];

    // If both steps are 0, no marks to generate
    if (rulerMinorStep === 0 && rulerMajorStep === 0) {
      return result;
    }

    const { startRange, endRange } = viewport;

    // If smallStep is 0, only generate big marks (at bigStep intervals)
    if (rulerMinorStep === 0) {
      const firstMark = Math.ceil(startRange / rulerMajorStep) * rulerMajorStep;
      for (let value = firstMark; value <= endRange; value += rulerMajorStep) {
        const position = (value - viewport.startRange) * scale;
        result.push({ position, value, isMajor: true });
      }
    } else {
      // Normal case: generate all marks
      const firstMark = Math.ceil(startRange / rulerMinorStep) * rulerMinorStep;
      for (let value = firstMark; value <= endRange; value += rulerMinorStep) {
        const position = (value - viewport.startRange) * scale;
        const isMajor = rulerMajorStep > 0 && value % rulerMajorStep === 0;
        result.push({ position, value, isMajor });
      }
    }

    return result;
  });

  // group marks by position to handle overlapping big/small marks
  const groupedMarks = $derived.by(() => {
    const map = new Map<number, { position: number; value: number; isMajor: boolean }>();
    for (const mark of marks) {
      const existing = map.get(mark.position);
      if (!existing || mark.isMajor) {
        map.set(mark.position, { position: mark.position, value: mark.value, isMajor: mark.isMajor });
      }
    }
    return Array.from(map.values());
  });

  // Hide entire ruler when both steps are 0
  const shouldShowRuler = $derived(rulerMinorStep > 0 || rulerMajorStep > 0);
</script>

{#if shouldShowRuler}
  <div id="timeline-ruler" class="relative h-9 border-b focus:outline-none overflow-hidden">
    {#each groupedMarks as mark, markIndex (markIndex)}
      {#if mark.isMajor && rulerMajorStep > 0}
        <div class="absolute bottom-0 w-px h-[80%] bg-muted-foreground -translate-x-1/2" style:left="{mark.position}px">
          <span class="absolute text-xs -top-1 left-0.5 pb-0.5 whitespace-nowrap text-muted-foreground">
            {mark.value}
          </span>
        </div>
      {:else if rulerMinorStep > 0}
        <div
          class="absolute bottom-0 w-px h-[40%] bg-muted-foreground -translate-x-1/2"
          style:left="{mark.position}px"
        ></div>
      {/if}
    {/each}
  </div>
{/if}
