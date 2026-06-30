<script lang="ts">
  // ---------------------------------------------------------------------------
  // PolygonCreateShape.svelte — Polygon creation overlay
  //
  // Renders a preview of the polygon being drawn — connected lines, vertex dots,
  // trailing line to cursor, and a highlight ring around the first point (close
  // target). Handles mousedown for point placement & polygon completion.
  //
  // Used by ShapesContainer in polygon build mode.
  // ---------------------------------------------------------------------------

  import { onMount } from "svelte";

  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";

  import type { Point } from "$lib/utils/math/point";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    onSelection: (type: string, points?: Point[], extraProps?: Record<string, unknown>, id?: string) => void;
  };

  let { cursor, mediaWidth, mediaHeight, onSelection }: Props = $props();

  // Keep points at fixed screen size regardless of zoom
  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let R_vertex = $derived(5 * invScale);
  let R_ring = $derived(8 * invScale);

  // ── Exported mouse handler ────────────────────────────────────────────
  /**
   * Called from ShapesContainer on mousedown when in polygon mode.
   * If the cursor is close (<20px) to the first point and we have ≥3 points,
   * the polygon is completed and onSelection is fired.
   * Otherwise a new point is added to the draft.
   *
   * Returns true if the event was consumed (polygon creation handled).
   */
  export function handleMouseDown(cursor: Point): boolean {
    // ── Close polygon (click near first point with ≥3 points) ──────────
    if (
      nearFirstPolygonPoint(cursor, mediaWidth, mediaHeight, polygonDraft.points, viewport.workspace.transform.scale)
    ) {
      const pts = [...polygonDraft.points];
      polygonDraft.reset();
      // Route through onSelection so the workspace can apply pendingValue (selected category)
      onSelection("idah-image:polygon", pts);
      return true;
    }

    // ── Add a new point ────────────────────────────────────────────────
    getDriver().command.call("annotation.polygon.add_point", { point: cursor });
    return true;
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  onMount(() => {
    return () => {
      polygonDraft.reset();
    };
  });
</script>

{#if polygonDraft.points.length > 0}
  {@const pts = polygonDraft.points}
  {@const cursorPos = cursor}

  <!-- Draw path connecting all placed points -->
  <polyline
    points={pts.map((p) => `${p[0] * mediaWidth},${p[1] * mediaHeight}`).join(" ")}
    fill="none"
    stroke="rgba(246, 64, 43, 0.8)"
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />

  <!-- Line from last point to cursor -->
  <line
    x1={pts[pts.length - 1][0] * mediaWidth}
    y1={pts[pts.length - 1][1] * mediaHeight}
    x2={cursorPos[0] * mediaWidth}
    y2={cursorPos[1] * mediaHeight}
    stroke="rgba(246, 64, 43, 0.4)"
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />

  <!-- Vertex dots at each placed point -->
  {#each pts as p}
    <circle
      cx={p[0] * mediaWidth}
      cy={p[1] * mediaHeight}
      r={R_vertex}
      fill="rgba(246, 64, 43, 0.9)"
      stroke="white"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  {/each}

  <!-- Highlight first point (close target) -->
  <circle
    cx={pts[0][0] * mediaWidth}
    cy={pts[0][1] * mediaHeight}
    r={R_ring}
    fill="none"
    stroke="rgba(246, 64, 43, 0.9)"
    stroke-width="2"
    stroke-dasharray="2,2"
    vector-effect="non-scaling-stroke"
  />
{/if}
