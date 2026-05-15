<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { scalePolygon, polygonCentroid } from "./utils";

  let {
    baseVertices,
    color,
    cursor,
    onScaleUpdate,
  }: {
    baseVertices: Point[];
    color: string;
    cursor?: Point;
    onScaleUpdate?: (scaled: Point[]) => void;
  } = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  // Scale bar state
  let scaleBarActive: boolean = $state(false);
  let scaleBarStartX: number = $state(0);
  let scaleBarCurrentX: number = $state(0);
  let scaleBarFactor: number = $state(1);
  let _scaledVertices: Point[] | undefined = $state();
  let lastDragCursor: Point = $state([-1, -1]);

  let displayVertices = $derived(_scaledVertices ?? baseVertices);

  // Scale bar drag: horizontal movement controls scale factor
  $effect(() => {
    if (!scaleBarActive || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    scaleBarCurrentX = cursor[0];

    // Compute factor from horizontal delta: moving right = scale up, left = scale down
    // Sensitivity: 1 pixel of movement = 0.5% scale change
    const dx = (cursor[0] - scaleBarStartX) * w;
    const factor = Math.max(0.1, Math.min(10, 1 + dx * 0.005));
    scaleBarFactor = factor;
    _scaledVertices = scalePolygon(baseVertices, factor);
    onScaleUpdate?.(_scaledVertices);
  });

  // ── Scale bar layout ──────────────────────────────────────────────────
  let centroidN = $derived(polygonCentroid(displayVertices));
  let centroidPx: Point = $derived([centroidN[0] * w, centroidN[1] * h]);
  let barLength = $derived(120 * invScale);
  let barY = $derived(centroidPx[1]);
  let barX1 = $derived(centroidPx[0] - barLength / 2);
  let barX2 = $derived(centroidPx[0] + barLength / 2);
  let thumbX = $derived(centroidPx[0] + (scaleBarFactor - 1) * (barLength / 2) * 0.5);
  let thumbXClamped = $derived(Math.max(barX1, Math.min(barX2, thumbX)));

  /** Start the scale bar interaction at the given normalized X coordinate. */
  export function startScale(normX: number) {
    scaleBarActive = true;
    scaleBarStartX = normX;
    scaleBarCurrentX = normX;
    scaleBarFactor = 1;
    _scaledVertices = [...baseVertices];
    onScaleUpdate?.(_scaledVertices);
  }

  /** End the scale bar interaction and return the scaled vertices (if any). */
  export function endScale(): Point[] | undefined {
    const result = _scaledVertices;
    scaleBarActive = false;
    scaleBarFactor = 1;
    _scaledVertices = undefined;
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
  <text x={barX1} y={barY - 10 * invScale} text-anchor="middle" fill="white" font-size={10 * invScale} pointer-events="none">0.5×</text>
  <text x={centroidPx[0]} y={barY - 10 * invScale} text-anchor="middle" fill="white" font-size={10 * invScale} pointer-events="none">1×</text>
  <text x={barX2} y={barY - 10 * invScale} text-anchor="middle" fill="white" font-size={10 * invScale} pointer-events="none">2×</text>
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
  <!-- Invisible wide hit zone for the thumb -->
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
  >
    {scaleBarFactor.toFixed(2)}×
  </text>
{/if}