<script lang="ts">
  // ---------------------------------------------------------------------------
  // CircleShape.svelte — Circle annotation shape
  //
  // Renders a circle defined by a center point and a radius.
  // The shape stores:
  //   shape.points = [[cx, cy]]  // center (normalized)
  //   shape.radius = r           // normalized radius (0-1 relative to min(w,h))
  //
  // Handles:
  //   • Drag center → pan (move)
  //   • Drag edge handle → resize radius
  //   • Invisible wider stroke along the edge for easy hit testing
  //
  // Selection API:
  //   • startSelection(point) → returns true if point is on the circle edge
  //     or inside the circle body
  //   • endSelection(point) → finalises the edit
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import { type Point, distance } from "$lib/utils/math/point";
  import CircleHandler from "./Circle/_CircleHandler.svelte";
  import { hitTestCircleEdge, pointInCircle } from "./Circle/utils";

  import { DEFAULT_MODE, type IImageAnnotationShape } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], angle: number) => void;
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

  // ── Base shape data from annotation ───────────────────────────────────
  let baseCenter = $derived.by((): Point => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    const pts = shape?.points ?? [];
    return pts.length > 0 ? (pts[0] as Point) : [0.5, 0.5];
  });

  let baseRadius = $derived.by((): number => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return (shape?.radius as number) ?? 0.1;
  });

  // ── Editing state ───────────────────────────────────────────────────────
  let _localCenter: Point | undefined = $state();
  let _localRadius: number | undefined = $state();
  let isResizing: boolean = $state(false);
  let panStart: Point | undefined = $state();
  let resizeStartCursor: Point | undefined = $state();
  let resizeStartRadius: number = $state(0);

  let center = $derived(_localCenter ?? baseCenter);
  let radius = $derived(_localRadius ?? baseRadius);

  let isEditing = $derived(isResizing || panStart !== undefined);

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

  // ── Display values ────────────────────────────────────────────────────
  let displayCenter = $derived.by((): Point => {
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      return [center[0] + panOffset[0], center[1] + panOffset[1]];
    }
    return center;
  });

  let displayRadius = $derived.by((): number => {
    if (isResizing && resizeStartCursor && cursor) {
      const scale = Math.min(w, h);
      const centerPx: Point = [displayCenter[0] * w, displayCenter[1] * h];
      const cursorPxLocal: Point = [cursor[0] * w, cursor[1] * h];
      const dist = distance(centerPx, cursorPxLocal);
      return Math.max(0.005, dist / scale); // Minimum radius
    }
    return _localRadius ?? baseRadius;
  });

  // ── Resize effect ─────────────────────────────────────────────────────
  let lastResizeCursor: Point = $state([-1, -1]);

  $effect(() => {
    if (!isResizing || !cursor) return;
    if (cursor[0] === lastResizeCursor[0] && cursor[1] === lastResizeCursor[1]) return;
    lastResizeCursor = cursor;
  });

  // ── Pixel-space circle radius for rendering ───────────────────────────
  let displayRadiusPx = $derived(displayRadius * Math.min(w, h));

  // ── Emit complete ─────────────────────────────────────────────────────
  function emitComplete() {
    const finalCenter = _localCenter ?? baseCenter;
    const finalRadius = _localRadius ?? baseRadius;
    const pts: Point[] = [finalCenter];
    onEditComplete?.(pts, { radius: finalRadius });
  }

  // ── Constants for hit testing ─────────────────────────────────────────
  const EDGE_HIT_RADIUS_PX = 12; // Wide invisible edge zone

  // ── Selection API ─────────────────────────────────────────────────────
  export function startSelection(start: Point, _shiftKey?: boolean): boolean {
    if (!editable) return false;
    if (!baseCenter || baseRadius <= 0) return false;

    const scale = viewport.workspace.transform.scale;

    // Check edge first (higher priority for resize)
    if (hitTestCircleEdge(start, baseCenter, baseRadius, w, h, EDGE_HIT_RADIUS_PX, scale)) {
      isResizing = true;
      resizeStartCursor = cursor ? [...cursor] : start;
      resizeStartRadius = baseRadius;
      _localCenter = [...baseCenter];
      _localRadius = baseRadius;
      return true;
    }

    // Check body (for panning)
    if (pointInCircle(start, baseCenter, baseRadius, w, h)) {
      panStart = [start[0] * w, start[1] * h];
      _localCenter = [...baseCenter];
      _localRadius = baseRadius;
      return true;
    }

    return false;
  }

  export function endSelection(_end: Point) {
    // Snapshot final values before any state cleanup
    const finalRadius = isResizing ? displayRadius : (_localRadius ?? baseRadius);
    const finalCenter = panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)
      ? [center[0] + panOffset[0], center[1] + panOffset[1]] as Point
      : (_localCenter ?? baseCenter);

    let changed = false;

    if (isResizing) {
      changed = true;
      isResizing = false;
      resizeStartCursor = undefined;
    }

    if (panStart) {
      if (panOffset[0] !== 0 || panOffset[1] !== 0) {
        changed = true;
      }
      panStart = undefined;
    }

    if (changed) {
      onEditComplete?.([finalCenter], { radius: finalRadius });
    }

    _localCenter = undefined;
    _localRadius = undefined;
  }

  // ── Internal handlers ─────────────────────────────────────────────────
  function handleStartResize() {
    isResizing = true;
    resizeStartCursor = cursor ? [...cursor] : [...baseCenter];
    resizeStartRadius = baseRadius;
    _localCenter = [...baseCenter];
    _localRadius = baseRadius;
  }

  function handleStartPan() {
    panStart = cursor ? [cursor[0] * w, cursor[1] * h] : undefined;
    _localCenter = [...baseCenter];
    _localRadius = baseRadius;
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

{#if baseCenter && baseRadius > 0}
  <!-- Invisible wide hit area for edge (for selection ease) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <circle
    cx={baseCenter[0] * w}
    cy={baseCenter[1] * h}
    r={displayRadiusPx}
    fill="transparent"
    stroke="transparent"
    stroke-width={EDGE_HIT_RADIUS_PX * 2}
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
            startSelection(norm, e.shiftKey);
          }
        }
      }
      e.stopPropagation();
    }}
  />

  <!-- Visible filled circle -->
  <circle
    cx={displayCenter[0] * w}
    cy={displayCenter[1] * h}
    r={displayRadiusPx}
    fill={color}
    fill-opacity={selected ? 0.4 : 0.2}
    stroke={color}
    stroke-width={selected ? 2 : 1.5}
    vector-effect="non-scaling-stroke"
    style={shapeStyleString}
    pointer-events="none"
  />

  <!-- Handles when selected -->
  {#if editable && selected}
    <CircleHandler
      center={displayCenter}
      displayRadius={displayRadius}
      {color}
      {isEditing}
      onStartResize={handleStartResize}
      onStartPan={handleStartPan}
    />
  {/if}
{/if}
