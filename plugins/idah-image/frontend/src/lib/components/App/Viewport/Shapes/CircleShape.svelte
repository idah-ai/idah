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
  //   • Drag center handle → opens scale bar to resize radius (like Polygon centroid)
  //   • Drag body → pan (move)
  //
  // Selection API:
  //   • startSelection(point) → returns true if point is inside the circle body
  //   • endSelection(point) → finalises the edit
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import { type Point } from "$lib/utils/math/point";
  import CircleHandler from "./Circle/_CircleHandler.svelte";
  import CircleScaleHandler from "./Circle/_CircleScaleHandler.svelte";
  import { pointInCircle } from "./Circle/utils";

  import { DEFAULT_MODE, type IImageAnnotationShape } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps?: Record<string, unknown>) => void;
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
  let scaleHandler: CircleScaleHandler | undefined = $state();
  let panStart: Point | undefined = $state();

  let center = $derived(_localCenter ?? baseCenter);
  let radius = $derived(_localRadius ?? baseRadius);

  let isEditing = $derived(panStart !== undefined || (scaleHandler?.isActive() ?? false));

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
    return _localRadius ?? baseRadius;
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

  // ── Selection API ─────────────────────────────────────────────────────
  export function startSelection(start: Point, _shiftKey?: boolean): boolean {
    if (!editable) return false;
    if (!baseCenter || baseRadius <= 0) return false;

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
    let changed = false;

    // Finish scale bar interaction
    if (scaleHandler?.isActive()) {
      const newRadius = scaleHandler.endScale();
      if (newRadius !== undefined) {
        _localRadius = newRadius;
        if (_localCenter === undefined) {
          _localCenter = [...baseCenter];
        }
        changed = true;
      }
    }

    // Finish pan
    if (panStart) {
      if (panOffset[0] !== 0 || panOffset[1] !== 0) {
        _localCenter = [center[0] + panOffset[0], center[1] + panOffset[1]] as Point;
        changed = true;
      }
      panStart = undefined;
    }

    if (changed) {
      emitComplete();
    }

    _localCenter = undefined;
    _localRadius = undefined;
  }

  // ── Internal handlers ─────────────────────────────────────────────────
  function handleStartScale() {
    if (!cursor) return;
    _localCenter = [...baseCenter];
    _localRadius = baseRadius;
    scaleHandler?.startScale(cursor[0]);
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
</script>

{#if baseCenter && baseRadius > 0}
  <!-- Invisible wide hit area for the body (for selection ease) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <circle
    cx={baseCenter[0] * w}
    cy={baseCenter[1] * h}
    r={displayRadiusPx}
    fill="transparent"
    stroke="transparent"
    stroke-width={12}
    vector-effect="non-scaling-stroke"
    style:outline="none"
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
      {color}
      {isEditing}
      onStartScale={handleStartScale}
    />
  {/if}

  <!-- Scale bar (rendered even when not dragging, visible only when active) -->
  <CircleScaleHandler
    bind:this={scaleHandler}
    baseRadius={baseRadius}
    center={displayCenter}
    {color}
    {cursor}
    onScaleUpdate={(newRadius) => {
      _localRadius = newRadius;
    }}
  />
{/if}
