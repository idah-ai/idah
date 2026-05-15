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
  import type { Point } from "$lib/utils/math/point";
  import { clampPoint } from "$lib/utils/math/point";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { getDriver } from "$lib/state/driver.svelte";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    frame: number;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
  };

  let { cursor, mediaWidth, mediaHeight, frame, onSelection }: Props = $props();

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
    const clampedCursor = clampPoint(cursor);

    // ── Close polygon (click near first point with ≥3 points) ──────────
    if (polygonDraft.points.length >= 3) {
      const first = polygonDraft.points[0];
      const dx = Math.abs(clampedCursor[0] - first[0]) * mediaWidth;
      const dy = Math.abs(clampedCursor[1] - first[1]) * mediaHeight;
      if (dx * dx + dy * dy < 400) {
        const pts = [...polygonDraft.points];
        polygonDraft.reset();
        // Route through onSelection so the workspace can apply pendingValue (selected category)
        onSelection("idah-video:polygon", frame, pts, 0, undefined);
        return true;
      }
    }

    // ── Add a new point ────────────────────────────────────────────────
    getDriver().command.call("annotation.polygon.add_point", { point: clampedCursor });
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
    stroke-dasharray="4,2"
    vector-effect="non-scaling-stroke"
  />

  <!-- Line from last point to cursor -->
  <line
    x1={pts[pts.length - 1][0] * mediaWidth}
    y1={pts[pts.length - 1][1] * mediaHeight}
    x2={cursorPos[0] * mediaWidth}
    y2={cursorPos[1] * mediaHeight}
    stroke="rgba(246, 64, 43, 0.4)"
    stroke-width="1.5"
    stroke-dasharray="3,3"
    vector-effect="non-scaling-stroke"
  />

  <!-- Vertex dots at each placed point -->
  {#each pts as p}
    <circle
      cx={p[0] * mediaWidth}
      cy={p[1] * mediaHeight}
      r={4}
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
    r={6}
    fill="none"
    stroke="rgba(246, 64, 43, 0.9)"
    stroke-width="2"
    stroke-dasharray="2,2"
    vector-effect="non-scaling-stroke"
  />
{/if}
