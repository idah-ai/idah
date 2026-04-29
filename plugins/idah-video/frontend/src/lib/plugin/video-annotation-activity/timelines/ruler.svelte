<script lang="ts">
  import type { TimelineRulerProps } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Props
  interface Props extends TimelineRulerProps {
    scale: number;
  }

  let {
    viewport,
    rulerMajorStep = 10,
    rulerMinorStep = 50,
    rulerLabelFormatter = (value: number) => String(Math.floor(value)),
    scale,
  }: Props = $props();

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
  <div class="ruler">
    {#each groupedMarks as mark, markIndex (markIndex)}
      {#if mark.isMajor && rulerMajorStep > 0}
        <!-- bg-muted-foreground absolute bottom-0 h-[80%] w-px -translate-x-1/2 -->
        <div class="mark major" style:left="{mark.position}px">
          <span class="label">{rulerLabelFormatter?.(mark.value)} </span>
        </div>
      {:else if rulerMinorStep > 0}
        <!-- bg-muted-foreground absolute bottom-0 h-[40%] w-px -translate-x-1/2 -->
        <div class="mark minor" style:left="{mark.position}px"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ruler {
    position: relative;
    height: 30px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
    overflow: hidden;
  }

  .mark {
    position: absolute;
    bottom: 0;
    transform: translateX(-50%);
  }

  .mark.minor:after {
    position: absolute;
    content: "";
    bottom: 0;
    width: 1px;
    height: 8px;
    background-color: #999;
    transform: rotateZ(15deg);
  }

  .mark.major:after {
    position: absolute;
    content: "";
    bottom: 0;
    width: 1px;
    height: 16px;
    background-color: #333;
    transform: rotateZ(15deg) translateX(2px);
  }

  .label {
    position: absolute;
    top: -1.5rem;
    left: 0.25rem;
    transform: translateX(-50%);
    font-size: 12px;
    font-family: sans-serif;
    color: #333;
    white-space: nowrap;
    padding-bottom: 2px;
  }
</style>
