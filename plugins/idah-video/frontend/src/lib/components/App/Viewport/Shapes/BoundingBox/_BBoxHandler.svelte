<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { boundingBoxHandle, handleCursor, rotatedCursorSVG, rotateCursorSVG } from "./utils";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  type Props = {
    displayPoints: Point[];
    centroidN: Point;
    centroidPx: Point;
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
    displayPoints,
    centroidN,
    centroidPx,
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

  // Inverse scale to compensate for viewBox zoom/pan — keeps handles constant screen size
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  // ── Hover states ──────────────────────────────────────────────────────
  let hoveredHandleIndex: number | undefined = $state();
  let hoveredRotate = $state(false);
  let hoveredRevMinus = $state(false);
  let hoveredRevPlus = $state(false);

  let rotationLayout = $derived.by(() => {
    const allY = displayPoints.map((p) => p[1]);
    const allX = displayPoints.map((p) => p[0]);
    const minYVal = Math.min(...allY);
    const minXVal = Math.min(...allX);
    const maxXVal = Math.max(...allX);
    const topMidN: Point = [(minXVal + maxXVal) / 2, minYVal];
    const handleDist = 70 * invScale;
    const ratio = Math.max(w, h);
    const rotOffset = handleDist / ratio;

    const rHandlePxX = topMidN[0] * w;
    const rHandlePxY = (topMidN[1] - rotOffset) * h;

    const dxR = rHandlePxX - centroidPx[0];
    const dyR = rHandlePxY - centroidPx[1];
    const cosA = Math.cos(currentAngle);
    const sinA = Math.sin(currentAngle);
    const rotHPxX = centroidPx[0] + dxR * cosA - dyR * sinA;
    const rotHPxY = centroidPx[1] + dxR * sinA + dyR * cosA;

    return { topMidN, rotOffset, rHandlePxX, rHandlePxY, rotHPxX, rotHPxY };
  });

  // ── Sizes (scaled by invScale) ────────────────────────────────────────
  let R = $derived(7 * invScale); // outer visible handle radius
  let R_hovered = $derived(9 * invScale); // hover-expanded radius
  let R_hit = $derived(10 * invScale); // interactive hit zone radius
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
    x1={rotationLayout.topMidN[0] * w}
    y1={rotationLayout.topMidN[1] * h}
    x2={rotationLayout.topMidN[0] * w}
    y2={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />
  <!-- Rotation top dot: white outline + filled center -->
  <circle
    cx={rotationLayout.topMidN[0] * w}
    cy={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
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
      const cp: Point = [centroidN[0] * w, centroidN[1] * h];
      onStartRotate(cp);
    }}
    cx={rotationLayout.topMidN[0] * w}
    cy={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    r={R_rotate_hit}
    fill="transparent"
    style:cursor={isEditing ? "none" : `url('${rotateCursorSVG(color)}') 18 18, grab`}
  />
  <circle
    cx={rotationLayout.topMidN[0] * w}
    cy={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    r={hoveredRotate ? R_rotate_hovered : R_rotate}
    fill={color}
    fill-opacity={rotateFillOpacity}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />

  <!-- Resize handles -->
  {#each boundingBoxHandle(displayPoints) as point, handleIndex (handleIndex)}
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

<!-- Revolution controls -->
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
