<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";

  type Props = {
    /** Box start in normalized coordinates. */
    start: Point;
    /** Box end in normalized coordinates. */
    end: Point;
    color: string;
  };

  let { start, end, color }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);

  let x = $derived(Math.min(start[0], end[0]) * w);
  let y = $derived(Math.min(start[1], end[1]) * h);
  let bw = $derived(Math.abs(end[0] - start[0]) * w);
  let bh = $derived(Math.abs(end[1] - start[1]) * h);
</script>

<rect
  {x}
  {y}
  width={bw}
  height={bh}
  fill={color}
  fill-opacity="0.08"
  stroke={color}
  stroke-width="1.5"
  stroke-dasharray="4,3"
  vector-effect="non-scaling-stroke"
  pointer-events="none"
/>
