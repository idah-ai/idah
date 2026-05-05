<script lang="ts">
  import type { Viewport } from "$lib/plugin/video-annotation-activity/components/Timeline/types";

  interface Props {
    viewport: Viewport;
    scale: number;
    smallStep?: number;
    bigStep?: number;
    labelFormatter?: (value: number) => string;
  }

  let {
    viewport,
    scale,
    smallStep = 10,
    bigStep = 50,
    labelFormatter = (value: number) => String(Math.floor(value)),
  }: Props = $props();

  // Generate all marks (small and big) within the viewport range
  const marks = $derived.by(() => {
    const result: Array<{ position: number; value: number; isBig: boolean }> = [];

    // If both steps are 0, no marks to generate
    if (smallStep === 0 && bigStep === 0) {
      return result;
    }

    const { startRange, endRange } = viewport;

    // If smallStep is 0, only generate big marks (at bigStep intervals)
    if (smallStep === 0) {
      const firstMark = Math.ceil(startRange / bigStep) * bigStep;
      for (let value = firstMark; value <= endRange; value += bigStep) {
        const position = (value - viewport.startRange) * scale;
        result.push({ position, value, isBig: true });
      }
    } else {
      // Normal case: generate all marks
      const firstMark = Math.ceil(startRange / smallStep) * smallStep;
      for (let value = firstMark; value <= endRange; value += smallStep) {
        const position = (value - viewport.startRange) * scale;
        const isBig = bigStep > 0 && value % bigStep === 0;
        result.push({ position, value, isBig });
      }
    }

    return result;
  });

  // Group marks by position to handle overlapping big/small marks
  const groupedMarks = $derived.by(() => {
    const map = new Map<number, { position: number; value: number; isBig: boolean }>();
    for (const mark of marks) {
      const existing = map.get(mark.position);
      if (!existing || mark.isBig) {
        map.set(mark.position, { position: mark.position, value: mark.value, isBig: mark.isBig });
      }
    }
    return Array.from(map.values());
  });

  // Hide entire ruler when both steps are 0
  const shouldShowRuler = $derived(smallStep > 0 || bigStep > 0);
</script>

{#if shouldShowRuler}
  <div class="ruler">
    {#each groupedMarks as mark, markIndex (markIndex)}
      {#if mark.isBig && bigStep > 0}
        <div class="mark big" style="left: {mark.position}px;">
          <span class="label">{labelFormatter(mark.value)}</span>
        </div>
      {:else if smallStep > 0}
        <div class="mark small" style="left: {mark.position}px;"></div>
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

  .mark.small:after {
    position: absolute;
    content: "";
    bottom: 0;
    width: 1px;
    height: 8px;
    background-color: #999;
    /* transform: rotateZ(15deg); */
  }

  .mark.big:after {
    position: absolute;
    content: "";
    bottom: 0;
    width: 1px;
    height: 16px;
    background-color: #333;
    /* transform: rotateZ(15deg) translateX(2px); */
  }

  .label {
    position: absolute;
    top: -1.5rem;
    left: 0.25rem;
    /* transform: translateX(-50%); */
    font-size: 12px;
    font-family: sans-serif;
    color: #333;
    white-space: nowrap;
    padding-bottom: 2px;
  }
</style>
