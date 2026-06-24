<script lang="ts">
  // ---------------------------------------------------------------------------
  // _CircleScaleHandler.svelte — Scale bar for circle radius
  //
  // Displays a horizontal scale bar at the circle's center (centroid) that
  // lets the user resize the circle radius by dragging horizontally.
  //
  // Mimics the pattern from _PolygonScaleHandler.svelte.
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { Point } from "$lib/utils/math/point";

  let {
    baseRadius,
    color,
    cursor,
    onScaleUpdate,
    center: centroid,
  }: {
    baseRadius: number;
    color: string;
    cursor?: Point;
    onScaleUpdate?: (newRadius: number) => void;
    center: Point;
  } = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  // Scale bar state
  let scaleBarActive: boolean = $state(false);
  let scaleBarStartX: number = $state(0);
  let scaleBarCurrentX: number = $state(0);
  let scaleBarFactor: number = $state(1);
  let _scaledRadius: number | undefined = $state();
  let lastDragCursor: Point = $state([-1, -1]);

  let displayRadius = $derived(_scaledRadius ?? baseRadius);

  // Scale bar drag: horizontal movement controls scale factor
  $effect(() => {
    if (!scaleBarActive || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    scaleBarCurrentX = cursor[0];

    // Compute factor from horizontal delta using log2 mapping:
    // bar left edge = 0.5×, center = 1×, right edge = 2×
    const dx = (cursor[0] - scaleBarStartX) * w;
    const logFactor = dx / (barLength / 2);
    const factor = Math.max(0.5, Math.min(2, 2 ** logFactor));
    scaleBarFactor = factor;
    const newRadius = Math.max(0.005, baseRadius * factor);
    _scaledRadius = newRadius;
    onScaleUpdate?.(newRadius);
  });

  // ── Scale bar layout ──────────────────────────────────────────────────
  // The bar is positioned centered at the circle's center (centroid).
  let centroidPx: Point = $derived([centroid[0] * w, centroid[1] * h]);
  let barLength = $derived(120 * invScale);
  let barY = $derived(centroidPx[1]);
  let barX1 = $derived(centroidPx[0] - barLength / 2);
  let barX2 = $derived(centroidPx[0] + barLength / 2);
  let thumbX = $derived(centroidPx[0] + Math.log2(scaleBarFactor) * (barLength / 2));
  let thumbXClamped = $derived(Math.max(barX1, Math.min(barX2, thumbX)));

  /** Start the scale bar interaction at the given normalized X coordinate. */
  export function startScale(normX: number) {
    scaleBarActive = true;
    scaleBarStartX = normX;
    scaleBarCurrentX = normX;
    scaleBarFactor = 1;
    _scaledRadius = baseRadius;
    onScaleUpdate?.(baseRadius);
  }

  /** End the scale bar interaction and return the new radius (if any). */
  export function endScale(): number | undefined {
    const result = _scaledRadius;
    scaleBarActive = false;
    scaleBarFactor = 1;
    _scaledRadius = undefined;
    return result;
  }

  /** Whether the scale bar is currently active. */
  export function isActive(): boolean {
    return scaleBarActive;
  }
</script>

{#if scaleBarActive}
  <!-- Track line -->
  <line
    x1={barX1}
    y1={barY}
    x2={barX2}
    y2={barY}
    stroke={color}
    stroke-width={2 * invScale}
    stroke-linecap="round"
    pointer-events="none"
  />
  <!-- Scale markers -->
  <line
    x1={centroidPx[0]}
    y1={barY - 6 * invScale}
    x2={centroidPx[0]}
    y2={barY + 6 * invScale}
    stroke={color}
    stroke-width={1.5 * invScale}
    pointer-events="none"
  />
  <line
    x1={barX1}
    y1={barY - 4 * invScale}
    x2={barX1}
    y2={barY + 4 * invScale}
    stroke={color}
    stroke-width={1 * invScale}
    pointer-events="none"
  />
  <line
    x1={barX2}
    y1={barY - 4 * invScale}
    x2={barX2}
    y2={barY + 4 * invScale}
    stroke={color}
    stroke-width={1 * invScale}
    pointer-events="none"
  />
  <!-- Labels -->
  <text
    x={barX1}
    y={barY - 10 * invScale}
    text-anchor="middle"
    fill="white"
    font-size={10 * invScale}
    pointer-events="none"
    style="user-select:none">0.5×</text
  >
  <text
    x={centroidPx[0]}
    y={barY - 10 * invScale}
    text-anchor="middle"
    fill="white"
    font-size={10 * invScale}
    pointer-events="none"
    style="user-select:none">1×</text
  >
  <text
    x={barX2}
    y={barY - 10 * invScale}
    text-anchor="middle"
    fill="white"
    font-size={10 * invScale}
    pointer-events="none"
    style="user-select:none">2×</text
  >
  <!-- Thumb (draggable) -->
  <circle
    cx={thumbXClamped}
    cy={barY}
    r={6 * invScale}
    fill={color}
    stroke="white"
    stroke-width={2 * invScale}
    style:cursor="ew-resize"
    pointer-events="none"
  />
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <line
    x1={barX1}
    y1={barY}
    x2={barX2}
    y2={barY}
    stroke="transparent"
    stroke-width={20 * invScale}
    style:cursor="ew-resize"
    onmousedown={(e) => {
      e.stopPropagation();
      const svg = (e.currentTarget as SVGElement).ownerSVGElement;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM()?.inverse();
        if (ctm) {
          const svgPt = pt.matrixTransform(ctm);
          const normX = media.width > 0 ? svgPt.x / media.width : 0;
          startScale(normX);
        }
      }
    }}
  />
  <!-- Current factor display -->
  <text
    x={centroidPx[0]}
    y={barY + 24 * invScale}
    text-anchor="middle"
    fill="white"
    font-size={11 * invScale}
    font-weight="bold"
    pointer-events="none"
    style="user-select:none"
  >
    {scaleBarFactor.toFixed(2)}×
  </text>
{/if}
