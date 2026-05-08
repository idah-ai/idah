<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { boundingBoxHandle, handleCursor, rotatedCursorSVG, rotateCursorSVG } from "./bbox-utils";
  import { media } from "$lib/state/media.svelte";

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

  let rotationLayout = $derived.by(() => {
    const allY = displayPoints.map((p) => p[1]);
    const allX = displayPoints.map((p) => p[0]);
    const minYVal = Math.min(...allY);
    const minXVal = Math.min(...allX);
    const maxXVal = Math.max(...allX);
    const topMidN: Point = [(minXVal + maxXVal) / 2, minYVal];
    const handleDist = 60;
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
</script>

<g
  style:transform-origin="{centroidPx[0]}px {centroidPx[1]}px"
  style:transform="rotate({currentAngle}rad)"
>
  <!-- Rotation line + handle -->
  <line
    x1={rotationLayout.topMidN[0] * w}
    y1={rotationLayout.topMidN[1] * h}
    x2={rotationLayout.topMidN[0] * w}
    y2={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    stroke={color}
    stroke-width="2"
    pointer-events="none"
  />
  <circle
    cx={rotationLayout.topMidN[0] * w}
    cy={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    r={2}
    fill={color}
    pointer-events="none"
  />
  <circle
    role="slider"
    tabindex="0"
    style:outline="none"
    aria-valuenow={currentAngle * (180 / Math.PI)}
    onmousedown={(e) => {
      e.stopPropagation();
      const cp: Point = [centroidN[0] * w, centroidN[1] * h];
      onStartRotate(cp);
    }}
    cx={rotationLayout.topMidN[0] * w}
    cy={(rotationLayout.topMidN[1] - rotationLayout.rotOffset) * h}
    r={6}
    fill={color}
    fill-opacity="50%"
    style:cursor={isEditing ? "none" : `url('${rotateCursorSVG(color)}') 18 18, grab`}
  />

  <!-- Resize handles -->
  {#each boundingBoxHandle(displayPoints) as point, handleIndex (handleIndex)}
    <circle
      cx={point[0] * w}
      cy={point[1] * h}
      r={2}
      fill={color}
      stroke={color}
      pointer-events="none"
    />
    <circle
      role="grid"
      tabindex="-1"
      style:outline="none"
      onmousedown={(e) => {
        e.stopPropagation();
        onStartResize(handleIndex);
      }}
      cx={point[0] * w}
      cy={point[1] * h}
      r={5}
      fill="transparent"
      stroke={color}
      stroke-opacity="50%"
      style:cursor={isEditing ? "none" : `url('${rotatedCursorSVG(handleIndex, currentAngle, color)}') 18 18, ${handleCursor(handleIndex)}`}
    />
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
    stroke-width="2"
    stroke-dasharray="5,5"
    pointer-events="none"
  />
{/if}

<!-- Revolution controls -->
<line
  x1={rotationLayout.rotHPxX - 20 - 7}
  y1={rotationLayout.rotHPxY}
  x2={rotationLayout.rotHPxX - 20 + 7}
  y2={rotationLayout.rotHPxY}
  stroke={color}
  stroke-width="2"
/>
<circle
  role="button"
  tabindex="-1"
  style:outline="none"
  cx={rotationLayout.rotHPxX - 20}
  cy={rotationLayout.rotHPxY}
  r={7}
  fill={color}
  fill-opacity="1%"
  style:cursor="pointer"
  onmousedown={(e) => {
    e.stopPropagation();
    onDecrementRevolution();
  }}
/>

<text
  x={rotationLayout.rotHPxX}
  y={rotationLayout.rotHPxY - 20}
  text-anchor="middle"
  dominant-baseline="central"
  style:font-size="11px"
  style:font-weight="bold"
  style:fill={color}
  style:pointer-events="none"
  style:user-select="none"
>
  {(currentAngle * (180 / Math.PI)).toFixed(1)}° {revolutionDisplay}
</text>

<line
  x1={rotationLayout.rotHPxX + 20 - 7}
  y1={rotationLayout.rotHPxY}
  x2={rotationLayout.rotHPxX + 20 + 7}
  y2={rotationLayout.rotHPxY}
  stroke={color}
  stroke-width="2"
/>
<line
  x1={rotationLayout.rotHPxX + 20}
  y1={rotationLayout.rotHPxY - 7}
  x2={rotationLayout.rotHPxX + 20}
  y2={rotationLayout.rotHPxY + 7}
  stroke={color}
  stroke-width="2"
/>
<circle
  role="button"
  tabindex="-1"
  style:outline="none"
  cx={rotationLayout.rotHPxX + 20}
  cy={rotationLayout.rotHPxY}
  r={7}
  fill={color}
  fill-opacity="1%"
  style:cursor="pointer"
  onmousedown={(e) => {
    e.stopPropagation();
    onIncrementRevolution();
  }}
/>
