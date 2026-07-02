<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { ellipseHandles, handleCursor, rotatedCursorSVG, rotateCursorSVG } from "./utils";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  type Props = {
    centroid: Point;
    radiusX: number;
    radiusY: number;
    currentAngle: number;
    color: string;
    isEditing: boolean;
    cursorPx: Point | undefined;

    onStartResize: (handleIndex: number) => void;
    onStartRotate: (cursorCentroid: Point) => void;

    onDecrementRevolution: () => void;
    onIncrementRevolution: () => void;
    revolutionDisplay: string;
    rotateStart: boolean;
  };

  let {
    centroid: centroidN,
    radiusX,
    radiusY,
    currentAngle,
    color,
    isEditing,
    cursorPx,
    onStartResize,
    onStartRotate,
    onDecrementRevolution,
    onIncrementRevolution,
    revolutionDisplay,
    rotateStart,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);

  let centroidPx = $derived.by((): Point => [centroidN[0] * w, centroidN[1] * h]);

  // Inverse scale to compensate for viewBox zoom/pan — keeps handles constant screen size
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  // ── Hover states ──────────────────────────────────────────────────────
  let hoveredHandleIndex: number | undefined = $state();
  let hoveredRotate = $state(false);
  let hoveredRevMinus = $state(false);
  let hoveredRevPlus = $state(false);

  let handles = $derived(ellipseHandles(centroidN, radiusX, radiusY, currentAngle, w, h));

  // ── Rotation handle layout (unrotated — CSS transform handles rotation) ──
  let rotationLayout = $derived.by(() => {
    const aabbTopMidPx: Point = [centroidN[0] * w, (centroidN[1] - radiusY) * h];
    const handleDist = 25 * invScale;

    const rHandlePxX = aabbTopMidPx[0];
    const rHandlePxY = aabbTopMidPx[1] - handleDist;

    // Rotated position for the revolution controls (outside the CSS-rotated group)
    const dxR = rHandlePxX - centroidPx[0];
    const dyR = rHandlePxY - centroidPx[1];
    const cosA = Math.cos(currentAngle);
    const sinA = Math.sin(currentAngle);
    const rotHPxX = centroidPx[0] + dxR * cosA - dyR * sinA;
    const rotHPxY = centroidPx[1] + dxR * sinA + dyR * cosA;

    return { aabbTopMidPx, rHandlePxX, rHandlePxY, rotHPxX, rotHPxY, handleDist };
  });

  // ── Sizes (scaled by invScale) ────────────────────────────────────────
  let R = $derived(6 * invScale);
  let R_hovered = $derived(8 * invScale);
  let R_hit = $derived(8 * invScale);
  let R_center_dot = $derived(2.5 * invScale);
  let R_rotate = $derived(7 * invScale);
  let R_rotate_hovered = $derived(9 * invScale);
  let R_rotate_hit = $derived(10 * invScale);
  let R_rotate_dot = $derived(2.5 * invScale);
  let R_rev = $derived(7 * invScale);
  let R_rev_hovered = $derived(9 * invScale);
  let S_line = $derived(2.5 * invScale);
  let S_font = $derived(12 * invScale);
  let S_offset = $derived(14 * invScale);

  // ── Derived hover styles ──────────────────────────────────────────────
  let rotateFillOpacity = $derived(hoveredRotate ? 0.35 : 0.15);
  let revMinusFillOpacity = $derived(hoveredRevMinus ? 0.35 : 0.15);
  let revPlusFillOpacity = $derived(hoveredRevPlus ? 0.35 : 0.15);
</script>

<g style:transform-origin="{centroidPx[0]}px {centroidPx[1]}px" style:transform="rotate({currentAngle}rad)">
  <!-- Rotation line + handle -->
  <line
    x1={rotationLayout.aabbTopMidPx[0]}
    y1={rotationLayout.aabbTopMidPx[1]}
    x2={rotationLayout.rHandlePxX}
    y2={rotationLayout.rHandlePxY}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />
  <!-- Rotation top dot: white outline + filled center -->
  <circle
    cx={rotationLayout.rHandlePxX}
    cy={rotationLayout.rHandlePxY}
    r={R_rotate_dot}
    fill={color}
    pointer-events="none"
  />
  <circle
    role="slider"
    tabindex="0"
    style:outline="none"
    aria-valuenow={currentAngle * (180 / Math.PI)}
    onmouseenter={() => (hoveredRotate = true)}
    onmouseleave={() => (hoveredRotate = false)}
    onmousedown={(e) => {
      e.stopPropagation();
      onStartRotate(centroidPx);
    }}
    cx={rotationLayout.rHandlePxX}
    cy={rotationLayout.rHandlePxY}
    r={R_rotate_hit}
    fill="transparent"
    style:cursor={isEditing ? "none" : `url('${rotateCursorSVG(color)}') 18 18, grab`}
  />
  <circle
    cx={rotationLayout.rHandlePxX}
    cy={rotationLayout.rHandlePxY}
    r={hoveredRotate ? R_rotate_hovered : R_rotate}
    fill={color}
    fill-opacity={rotateFillOpacity}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />

  <!-- Resize handles -->
  {#each ellipseHandles(centroidN, radiusX, radiusY, 0, w, h) as point, handleIndex (handleIndex)}
    {@const isHovered = hoveredHandleIndex === handleIndex}
    {@const curR = isHovered ? R_hovered : R}
    {@const curFillOpacity = isHovered ? 0.5 : 0.25}
    <!-- White halo for contrast → expands on hover -->
    <circle
      cx={point[0] * w}
      cy={point[1] * h}
      r={isHovered ? R_hovered : R_hit}
      fill="white"
      fill-opacity={isHovered ? 0.8 : 0.6}
      pointer-events="none"
    />
    <!-- Transparent hit zone -->
    <circle
      role="grid"
      tabindex="-1"
      style:outline="none"
      onmouseenter={() => (hoveredHandleIndex = handleIndex)}
      onmouseleave={() => (hoveredHandleIndex = undefined)}
      onmousedown={(e) => {
        e.stopPropagation();
        onStartResize(handleIndex);
      }}
      cx={point[0] * w}
      cy={point[1] * h}
      r={R_hit}
      fill="transparent"
      style:cursor={isEditing
        ? "none"
        : `url('${rotatedCursorSVG(handleIndex, currentAngle, color)}') 18 18, ${handleCursor(handleIndex)}`}
    />
    <!-- Filled handle ring → grows and deepens on hover -->
    <circle
      cx={point[0] * w}
      cy={point[1] * h}
      r={curR}
      fill={color}
      fill-opacity={curFillOpacity}
      stroke={color}
      stroke-width={S_line}
      pointer-events="none"
    />
    <!-- Center dot -->
    <circle cx={point[0] * w} cy={point[1] * h} r={R_center_dot} fill={color} pointer-events="none" />
  {/each}
</g>

<!-- Rotation preview line -->
{#if rotateStart && cursorPx}
  <line
    x1={centroidPx[0]}
    y1={centroidPx[1]}
    x2={cursorPx[0]}
    y2={cursorPx[1]}
    stroke={color}
    stroke-width={S_line}
    stroke-dasharray="5,5"
    pointer-events="none"
  />
{/if}

<!-- Revolution controls (outside the CSS-rotated group so they stay screen-aligned) -->
<line
  x1={rotationLayout.rotHPxX - S_offset - R_rev}
  y1={rotationLayout.rotHPxY}
  x2={rotationLayout.rotHPxX - S_offset + R_rev}
  y2={rotationLayout.rotHPxY}
  stroke={color}
  stroke-width={S_line}
/>
<circle
  role="button"
  tabindex="-1"
  style:outline="none"
  onmouseenter={() => (hoveredRevMinus = true)}
  onmouseleave={() => (hoveredRevMinus = false)}
  cx={rotationLayout.rotHPxX - S_offset}
  cy={rotationLayout.rotHPxY}
  r={hoveredRevMinus ? R_rev_hovered : R_rev}
  fill={color}
  fill-opacity={revMinusFillOpacity}
  stroke={color}
  stroke-width={S_line}
  style:cursor="pointer"
  onmousedown={(e) => {
    e.stopPropagation();
    onDecrementRevolution();
  }}
/>

<text
  x={rotationLayout.rotHPxX}
  y={rotationLayout.rotHPxY - S_offset}
  text-anchor="middle"
  dominant-baseline="central"
  style:font-size="{S_font}px"
  style:font-weight="bold"
  style:fill={color}
  style:paint-order="stroke"
  style:stroke="white"
  style:stroke-width="3px"
  style:stroke-linecap="round"
  style:stroke-linejoin="round"
  style:pointer-events="none"
  style:user-select="none"
  vector-effect="non-scaling-stroke"
>
  {(currentAngle * (180 / Math.PI)).toFixed(1)}° {revolutionDisplay}
</text>

<line
  x1={rotationLayout.rotHPxX + S_offset - R_rev}
  y1={rotationLayout.rotHPxY}
  x2={rotationLayout.rotHPxX + S_offset + R_rev}
  y2={rotationLayout.rotHPxY}
  stroke={color}
  stroke-width={S_line}
/>
<line
  x1={rotationLayout.rotHPxX + S_offset}
  y1={rotationLayout.rotHPxY - R_rev}
  x2={rotationLayout.rotHPxX + S_offset}
  y2={rotationLayout.rotHPxY + R_rev}
  stroke={color}
  stroke-width={S_line}
/>
<circle
  role="button"
  tabindex="-1"
  style:outline="none"
  onmouseenter={() => (hoveredRevPlus = true)}
  onmouseleave={() => (hoveredRevPlus = false)}
  cx={rotationLayout.rotHPxX + S_offset}
  cy={rotationLayout.rotHPxY}
  r={hoveredRevPlus ? R_rev_hovered : R_rev}
  fill={color}
  fill-opacity={revPlusFillOpacity}
  stroke={color}
  stroke-width={S_line}
  style:cursor="pointer"
  onmousedown={(e) => {
    e.stopPropagation();
    onIncrementRevolution();
  }}
/>
