<script lang="ts">
  // ---------------------------------------------------------------------------
  // MaskPolygonCreateShape.svelte — Mask polygon creation overlay
  //
  // Same preview rendering as PolygonCreateShape, but on completion fills
  // the polygon into the mask session buffers and flushes.
  //
  // Uses its own draft state (maskPolygonDraft) separate from the vector
  // polygon's draft to avoid mode-switching conflicts.
  // ---------------------------------------------------------------------------

  import { onMount, onDestroy } from "svelte";
  import { hexToRgba } from "$lib/utils/color";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";
  import { maskPolygonDraft, setOnPointsChanged } from "$lib/commands/mode/mask_polygon";
  import { MASK_TILE_SIZE } from "$lib/mask/constants";
  import { maskSession } from "$lib/state/mask-session.svelte";
  import { tilesTouchedByPolygon } from "$lib/mask/grid";
  import { fillPolygon } from "$lib/mask/raster";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import { IMAGE_MASK } from "$lib/types";
  import { maskTool } from "$lib/state/mask-tool.svelte";
  import { rebuildOccupancy, isOccupied } from "$lib/mask/occupancy";

  import type { Point } from "$lib/utils/math/point";

  type Props = {
    cursor: Point;
    mediaWidth: number;
    mediaHeight: number;
    onFlush: () => void;
    color?: string;
  };

  let { cursor, mediaWidth, mediaHeight, onFlush, color = undefined }: Props = $props();

  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let R_vertex = $derived(5 * invScale);
  let R_ring = $derived(8 * invScale);

  // ── Local reactive snapshot of draft points for rendering ──────────────
  let _renderPoints: [number, number][] = $state([]);

  export function handleMouseDown(cursor: Point): boolean {
    // Cursor is already in normalized 0-1 media space (snappedCursor from parent)
    const normX = cursor[0];
    const normY = cursor[1];

    // Close polygon (click near first point with ≥3 points)
    if (
      nearFirstPolygonPoint(cursor, mediaWidth, mediaHeight, maskPolygonDraft.points, viewport.workspace.transform.scale)
    ) {
      const pts = maskPolygonDraft.points;

      // Save the closed polygon points so undo can restore the drawing preview
      maskPolygonDraft.closedPoints = pts;

      // Convert normalized points back to pixel coordinates, fill the mask and flush
      const pixelPoints: [number, number][] = pts.map((p) => [p[0] * mediaWidth, p[1] * mediaHeight]);
      maskPolygonDraft.clearPoints();

      // If editing an existing mask annotation, use its ID so the flush
      // writes to the existing annotation instead of creating a new one.
      const sel = selection.value;
      const existingAnnId = sel && (sel.shape as any)?.type === IMAGE_MASK ? sel.id : undefined;

      // NOTE(continuePending): `continuePending: existingAnnId === undefined`
      // evaluates to `true` whenever this is a new-mask polygon close (no
      // existing annotation to write to).  As in mask_brush.ts, `beginSession`'s
      // own `continuePending` check does NOT protect against buffer bleeding
      // between unrelated new-mask attempts — the real defense is that EVERY
      // abandonment path calls `maskSession.reset()` explicitly.  `continuePending:
      // true` is kept here because polygon fill on the same still-uncategorized
      // new mask must accumulate with any brush strokes already painted.
      maskSession.beginSession(existingAnnId, { continuePending: existingAnnId === undefined });

      // If editing an existing annotation, load its tiles into the session
      if (existingAnnId && data.annotations) {
        const record = data.annotations.items.find((a) => a.id === existingAnnId);
        if (record) {
          const shape = record.shape as Record<string, unknown>;
          for (const [key, val] of Object.entries(shape)) {
            if (!key.startsWith("tile-")) continue;
            const match = key.match(/^tile-(\d+)x(\d+)$/);
            if (!match) continue;
            const col = parseInt(match[1], 10);
            const row = parseInt(match[2], 10);
            const tileData = val as { rle?: string } | undefined;
            if (!tileData?.rle) continue;
            maskSession.ensureTileBuffer(col, row, tileData.rle);
          }
        }
      }

      // Rebuild occupancy grid if overlap prevention is enabled
      if (maskTool.preventOverlap && data.annotations) {
        rebuildOccupancy(data.annotations.items);
      }

      const touchedTiles = tilesTouchedByPolygon(pixelPoints);
      for (const { col, row } of touchedTiles) {
        const buf = maskSession.ensureTileBuffer(col, row);
        const tileOriginX = col * MASK_TILE_SIZE;
        const tileOriginY = row * MASK_TILE_SIZE;
        const checkOccupied = maskTool.preventOverlap
          ? (localPx: number, localPy: number) => isOccupied(col, row, localPx, localPy)
          : undefined;
        const painted = fillPolygon(buf, tileOriginX, tileOriginY, pixelPoints, maskSession.mode, mediaWidth, mediaHeight, checkOccupied);
        if (painted) {
          maskSession.markDirty(col, row);
        }
      }

      onFlush();
      return true;
    }

    // Add a new point through the command manager (undoable per-vertex)
    getDriver().command.call("annotation.mask_polygon.add_point", { point: [normX, normY] });
    return true;
  }

  onMount(() => {
    // Register the notification callback so this component re-renders
    // when the module-level draft points change.
    setOnPointsChanged(() => {
      _renderPoints = [...maskPolygonDraft.points];
    });
    // Initialize from current state
    _renderPoints = [...maskPolygonDraft.points];

    return () => {
      maskPolygonDraft.clearPoints();
      setOnPointsChanged(() => {});
    };
  });

  onDestroy(() => {
    setOnPointsChanged(() => {});
  });
</script>

{#if _renderPoints.length > 0}
  {@const pts = _renderPoints}
  {@const cursorPos = cursor}

  <polyline
    points={pts.map((p) => `${p[0] * mediaWidth},${p[1] * mediaHeight}`).join(" ")}
    fill="none"
    stroke={hexToRgba(color, 0.8)}
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />

  <line
    x1={pts[pts.length - 1][0] * mediaWidth}
    y1={pts[pts.length - 1][1] * mediaHeight}
    x2={cursorPos[0] * mediaWidth}
    y2={cursorPos[1] * mediaHeight}
    stroke={hexToRgba(color, 0.4)}
    stroke-width="2"
    stroke-dasharray="6,3"
    vector-effect="non-scaling-stroke"
  />

  {#each pts as p}
    <circle
      cx={p[0] * mediaWidth}
      cy={p[1] * mediaHeight}
      r={R_vertex}
      fill={hexToRgba(color, 0.9)}
      stroke="white"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  {/each}

  <circle
    cx={pts[0][0] * mediaWidth}
    cy={pts[0][1] * mediaHeight}
    r={R_ring}
    fill="none"
    stroke={hexToRgba(color, 0.9)}
    stroke-width="2"
    stroke-dasharray="2,2"
    vector-effect="non-scaling-stroke"
  />
{/if}
