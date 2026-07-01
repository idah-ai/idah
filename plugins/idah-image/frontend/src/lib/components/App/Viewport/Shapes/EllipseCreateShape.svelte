<script lang="ts">
  // ---------------------------------------------------------------------------
  // EllipseCreateShape.svelte — Ellipse creation overlay
  //
  // Draws from top-left to bottom-right (like BBox creation), inferring
  // the centroid and radii from the drag rectangle.
  //
  // Used by ShapesContainer in ellipse build mode.
  // ---------------------------------------------------------------------------
  import { onMount } from "svelte";

  import { IMAGE_ELLIPSE } from "$lib/types";
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

    const x1 = Math.min(buildStart[0], cursor[0]);
    const y1 = Math.min(buildStart[1], cursor[1]);
    const x2 = Math.max(buildStart[0], cursor[0]);
    const y2 = Math.max(buildStart[1], cursor[1]);
    buildStart = undefined;

    // Minimum size threshold: at least 1px width and 1px height
    const pixelWidth = Math.abs((x2 - x1) * mediaWidth);
    const pixelHeight = Math.abs((y2 - y1) * mediaHeight);
    if (pixelWidth < 1 || pixelHeight < 1) return false;

    // Compute centroid and radii
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;

    const points: Point[] = [[cx, cy], [rx, ry]];
    onSelection(IMAGE_ELLIPSE, points, { angle: 0 }, undefined);
    return true;
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  onMount(() => {
    return () => {
      buildStart = undefined;
    };
  });
</script>

{#if buildStart}
  {@const sx = buildStart[0] * mediaWidth}
  {@const sy = buildStart[1] * mediaHeight}
  {@const cx = cursor[0] * mediaWidth}
  {@const cy = cursor[1] * mediaHeight}
  <ellipse
    cx={(sx + cx) / 2}
    cy={(sy + cy) / 2}
    rx={Math.abs(cx - sx) / 2}
    ry={Math.abs(cy - sy) / 2}
    fill={fillColor}
    stroke={strokeColor}
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />
{/if}
