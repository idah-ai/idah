<script lang="ts">
  // ---------------------------------------------------------------------------
  // BBoxCreateShape.svelte — Bounding box creation overlay
  //
  // Renders a dashed preview rectangle while the user drags to define a new
  // bounding box annotation. Handles mousedown/mouseup for the creation flow.
  //
  // Used by ShapesContainer in bounding-box build mode.
  // ---------------------------------------------------------------------------

  import { onMount } from "svelte";
  import { hexToRgba } from "$lib/utils/color";
  import type { Point } from "$lib/utils/math/point";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    frame: number;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
    /** Category color for the preview shape. */
    color?: string;
  };

  let { cursor, mediaWidth, mediaHeight, frame, onSelection, color = undefined }: Props = $props();

  // ── Build state ────────────────────────────────────────────────────────
  let buildStart: Point | undefined = $state();

  // ── Exported mouse handlers ───────────────────────────────────────────
  /**
   * Called from ShapesContainer on mousedown when in bounding-box mode.
   * Records the start position of the bbox drag.
   */
  export function handleMouseDown(cursor: Point) {
    buildStart = cursor;
  }

  /**
   * Called from ShapesContainer on mouseup when in bounding-box mode.
   * Finalises the bbox from buildStart to the release point, then fires
   * onSelection if the bbox exceeds the minimum size threshold.
   */
  export function handleMouseUp(cursor: Point): boolean {
    if (!buildStart) return false;

    const x1 = Math.min(buildStart[0], cursor[0]);
    const y1 = Math.min(buildStart[1], cursor[1]);
    const x2 = Math.max(buildStart[0], cursor[0]);
    const y2 = Math.max(buildStart[1], cursor[1]);
    buildStart = undefined;

    // Minimum size threshold: at least 1px width and 1px height
    const pixelWidth  = Math.abs(x2 - x1) * mediaWidth;
    const pixelHeight = Math.abs(y2 - y1) * mediaHeight;
    if (pixelWidth < 1 || pixelHeight < 1) return false;

    const points: Point[] = [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ];
    onSelection("idah-video:bounding-box", frame, points, 0, undefined);
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
  <rect
    x={Math.min(sx, cx)}
    y={Math.min(sy, cy)}
    width={Math.abs(cx - sx)}
    height={Math.abs(cy - sy)}
    fill={hexToRgba(color, 0.15)}
    stroke={hexToRgba(color, 0.8)}
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />
{/if}
