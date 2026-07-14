<script lang="ts">
  // ---------------------------------------------------------------------------
  // LineShape.svelte — Line annotation shape
  //
  // Renders a line between 2 normalized points. Handles:
  //   • Drag endpoints → resize
  //   • Invisible wider stroke for easy hit testing and panning
  //
  // Selection API:
  //   • startSelection(point) → returns true if point is on the line/invisible area
  //   • endSelection(point) → finalises the edit
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import { type Point } from "$lib/utils/math/point";
  import LineHandler from "./Line/_LineHandler.svelte";
  import { hitTestLine } from "./Line/utils";

  import { DEFAULT_MODE, type IImageAnnotationShape } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps: Record<string, unknown>) => void;
  };

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = DEFAULT_MODE,
    onClick,
    onEditComplete,
  }: Props = $props();

  let color = $derived.by(() => resolveAnnotationColor(annotation));

  // ── Shape display styles from property options ─────────────────────────
  let shapeStyleString = $derived.by(() => resolveShapeStyles(annotation));

  // ── Media dimensions ──────────────────────────────────────────────────
  let w = $derived(media.width);
  let h = $derived(media.height);

  // ── Base points from annotation ───────────────────────────────────────
  let basePoints = $derived.by((): Point[] => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return shape?.points ?? [];
  });

  // ── Editing state ───────────────────────────────────────────────────────
  let _localPoints: Point[] | undefined = $state();
  let dragEndpointIndex: number | undefined = $state();
  let panStart: Point | undefined = $state();

  let isEditing = $derived(dragEndpointIndex !== undefined || panStart !== undefined);

  let points: Point[] = $derived(_localPoints ?? basePoints);

  // ── Pixel-space cursor ────────────────────────────────────────────────
  let cursorPx = $derived.by((): Point | undefined => {
    if (!cursor) return undefined;
    return [cursor[0] * w, cursor[1] * h];
  });

  // ── Pan offset ────────────────────────────────────────────────────────
  let panOffset = $derived.by((): Point => {
    if (panStart && cursorPx) {
      return [(cursorPx[0] - panStart[0]) / w, (cursorPx[1] - panStart[1]) / h];
    }
    return [0, 0];
  });

  // ── Display points ────────────────────────────────────────────────────
  let displayPoints = $derived.by((): Point[] => {
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      return points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]]) as Point[];
    }
    return points;
  });

  // ── Drag endpoint effect ──────────────────────────────────────────────
  let lastDragCursor: Point = $state([-1, -1]);

  $effect(() => {
    if (dragEndpointIndex === undefined || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    if (_localPoints) {
      _localPoints[dragEndpointIndex] = cursor;
      _localPoints = [..._localPoints];
    }
  });

  // ── Emit complete ─────────────────────────────────────────────────────
  function emitComplete() {
    const pts = _localPoints ?? points;
    if (pts.length < 2) return;
    onEditComplete?.(pts as Point[], {});
  }

  // ── Constants for hit testing ─────────────────────────────────────────
  const HIT_RADIUS_PX = 12; // Wide invisible hit zone for easier line selection

  // ── Selection API ─────────────────────────────────────────────────────
  export function startSelection(start: Point, _shiftKey?: boolean): boolean {
    if (!editable || points.length < 2) return false;

    // Check if cursor is within hit radius of the line
    if (!hitTestLine(start, points, w, h, HIT_RADIUS_PX, viewport.workspace.transform.scale)) {
      return false;
    }

    // Start pan by default (click anywhere on the line starts moving it)
    panStart = [start[0] * w, start[1] * h];
    _localPoints = [...points];
    return true;
  }

  export function endSelection(_end: Point) {
    let changed = false;
    if (panStart) {
      if (panOffset[0] !== 0 || panOffset[1] !== 0) {
        _localPoints = points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]] as Point);
        changed = true;
      }
      panStart = undefined;
    }
    if (dragEndpointIndex !== undefined) {
      changed = true;
      dragEndpointIndex = undefined;
    }
    if (changed) {
      emitComplete();
    }
    _localPoints = undefined;
  }

  export function getIsEditing(): boolean {
    return isEditing;
  }

  function handleStartResize(endpointIndex: number) {
    dragEndpointIndex = endpointIndex;
    _localPoints = [...points];
  }

  // ── Cursor style ──────────────────────────────────────────────────────
  let bodyCursor = $derived(
    mode === "note" ? "cursor-note" :
    isEditing ? "cursor-grabbing" :
    editable && selected ? "cursor-grab" :
    "cursor-pointer"
  );

  let over = $state(false);
</script>

{#if displayPoints.length >= 2}
  <!-- Invisible wide hit area for easy selection -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <line
    x1={displayPoints[0][0] * w}
    y1={displayPoints[0][1] * h}
    x2={displayPoints[1][0] * w}
    y2={displayPoints[1][1] * h}
    stroke="transparent"
    stroke-width={24}
    vector-effect="non-scaling-stroke"
    style:outline="none"
    onmouseenter={() => (over = true)}
    onmouseleave={() => (over = false)}
    class={bodyCursor}
    role="button"
    tabindex="-1"
    onclick={onClick}
    onmousedown={(e) => {
      if (viewport.isCreationMode) return;
      if (viewport.mode === "review") return;
      if (editable && selected) {
        const svg = (e.currentTarget as SVGElement).ownerSVGElement;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svg.getScreenCTM()?.inverse();
          if (ctm) {
            const svgPt = pt.matrixTransform(ctm);
            const norm: Point = [
              media.width > 0 ? svgPt.x / media.width : 0,
              media.height > 0 ? svgPt.y / media.height : 0,
            ];
            // Check endpoint proximity for resize
            const scale = viewport.workspace.transform.scale;
            const endpointHitRadiusSq = 64; // 8px^2
            for (let i = 0; i < points.length; i++) {
              const dx = Math.abs(norm[0] - points[i][0]) * w * scale;
              const dy = Math.abs(norm[1] - points[i][1]) * h * scale;
              if (dx * dx + dy * dy < endpointHitRadiusSq) {
                handleStartResize(i);
                e.stopPropagation();
                return;
              }
            }
            // Otherwise start pan
            startSelection(norm, e.shiftKey);
          }
        }
      }
      e.stopPropagation();
    }}
  />

  <!-- Visible line -->
  <line
    x1={displayPoints[0][0] * w}
    y1={displayPoints[0][1] * h}
    x2={displayPoints[1][0] * w}
    y2={displayPoints[1][1] * h}
    stroke={color}
    stroke-width={2}
    stroke-linecap="round"
    vector-effect="non-scaling-stroke"
    style={shapeStyleString}
    pointer-events="none"
  />

  <!-- Handles when selected -->
  {#if editable && selected && displayPoints.length >= 2}
    <LineHandler
      displayPoints={displayPoints}
      {color}
      {isEditing}
      onStartResize={handleStartResize}
    />
  {/if}
{/if}
