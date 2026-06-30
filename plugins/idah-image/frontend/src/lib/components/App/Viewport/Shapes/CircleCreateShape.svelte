<script lang="ts">
  // ---------------------------------------------------------------------------
  // CircleCreateShape.svelte — Circle creation overlay (center→radius)
  //
  // Click to place the center, then drag outward to define the radius.
  // Works like the original design: mousedown records the centroid, mouseup
  // computes the radius from cursor distance to center.
  //
  // Used by ShapesContainer in circle build mode.
  // ---------------------------------------------------------------------------
  import { onMount } from "svelte";

  import { IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE } from "$lib/types";
  import { hexToRgba } from "$lib/utils/color";

  import type { Point } from "$lib/utils/math/point";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    onSelection: (type: string, points?: Point[], extraProps?: Record<string, unknown>, id?: string) => void;
    /** Category color for the preview shape. */
    color?: string;
  };

  let { cursor, mediaWidth, mediaHeight, onSelection, color = undefined }: Props = $props();
  let strokeColor = $derived(hexToRgba(color, 0.8));
  let fillColor = $derived(hexToRgba(color, 0.15));

  // ── Build state ────────────────────────────────────────────────────────
  let buildStart: Point | undefined = $state();

  // ── Exported mouse handlers ───────────────────────────────────────────
  export function handleMouseDown(cursor: Point) {
    buildStart = cursor;
  }

  export function handleMouseUp(cursor: Point): boolean {
    if (!buildStart) return false;

    const center = buildStart;
    buildStart = undefined;

    const dx = (cursor[0] - center[0]) * mediaWidth;
    const dy = (cursor[1] - center[1]) * mediaHeight;
    const pixelRadius = Math.sqrt(dx * dx + dy * dy);
    if (pixelRadius < 2) return false;

    const scale = Math.min(mediaWidth, mediaHeight);
    const normalizedRadius = pixelRadius / scale;

    onSelection(IDAH_IMAGE_CIRCLE, [center], { radius: normalizedRadius }, undefined);
    return true;
  }

  onMount(() => {
    return () => {
      buildStart = undefined;
    };
  });
</script>

{#if buildStart}
  {@const cxCenter = buildStart[0] * mediaWidth}
  {@const cyCenter = buildStart[1] * mediaHeight}
  {@const cx = cursor[0] * mediaWidth}
  {@const cy = cursor[1] * mediaHeight}
  <circle
    cx={cxCenter}
    cy={cyCenter}
    r={Math.sqrt((cx - cxCenter) ** 2 + (cy - cyCenter) ** 2)}
    fill={fillColor}
    stroke={strokeColor}
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />
{/if}
