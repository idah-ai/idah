<script lang="ts">
  // ---------------------------------------------------------------------------
  // LineCreateShape.svelte — Line creation overlay (two-click)
  //
  // Works like polygon: click to place the first point, click again to place
  // the second point and complete the line. Renders a preview of the line
  // from the first point to the cursor while drawing.
  //
  // Used by ShapesContainer in line build mode.
  // ---------------------------------------------------------------------------
  import { onMount } from "svelte";

  import { IMAGE_LINE as IDAH_IMAGE_LINE } from "$lib/types";
  import { lineDraft } from "$lib/commands/annotation/line.add_point.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { Point } from "$lib/utils/math/point";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    onSelection: (type: string, points?: Point[], angle?: number, id?: string) => void;
  };

  let { cursor, mediaWidth, mediaHeight, onSelection }: Props = $props();

  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let R_vertex = $derived(5 * invScale);

  // ── Exported mouse handler ────────────────────────────────────────────
  export function handleMouseDown(cursor: Point): boolean {
    // If we already have one point, place the second and complete
    if (lineDraft.points.length === 1) {
      const pts = [lineDraft.points[0], cursor];
      lineDraft.reset();
      onSelection(IDAH_IMAGE_LINE, pts, 0, undefined);
      return true;
    }

    // Otherwise add the first point
    getDriver().command.call("annotation.line.add_point", { point: cursor });
    return true;
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  onMount(() => {
    return () => {
      lineDraft.reset();
    };
  });
</script>

{#if lineDraft.points.length > 0}
  {@const p1 = lineDraft.points[0]}
  {@const cursorPos = cursor}

  <!-- Line from first point to cursor -->
  <line
    x1={p1[0] * mediaWidth}
    y1={p1[1] * mediaHeight}
    x2={cursorPos[0] * mediaWidth}
    y2={cursorPos[1] * mediaHeight}
    stroke="rgba(246, 64, 43, 0.8)"
    stroke-width="2"
    stroke-dasharray="6,3"
    stroke-linecap="round"
    vector-effect="non-scaling-stroke"
  />

  <!-- Vertex dot at the placed point -->
  <circle
    cx={p1[0] * mediaWidth}
    cy={p1[1] * mediaHeight}
    r={R_vertex}
    fill="rgba(246, 64, 43, 0.9)"
    stroke="white"
    stroke-width="1.5"
    vector-effect="non-scaling-stroke"
  />
{/if}
