<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { polygonVertexHandles, polygonEdgeMidpoints } from "./utils";
  import BoxSelector from "./_BoxSelector.svelte";
  import removeCursorSvg from "$lib/assets/icons/remove-cursor.svg?raw";

  const removeCursorCss = `url("data:image/svg+xml,${encodeURIComponent(removeCursorSvg)}") 2 2,pointer`;

  type Props = {
    vertices: Point[];
    color: string;
    isEditing: boolean;
    selectedIndices: Set<number>;
    boxStart: Point | undefined;
    boxEnd: Point | undefined;
    shiftHeld: boolean;
    onStartVertexDrag: (vertexIndex: number) => void;
    onDeleteVertex: (vertexIndex: number) => void;
    onAddVertex: (edgeIndex: number) => void;
    onStartPan: () => void;
  };

  let {
    vertices,
    color,
    isEditing,
    selectedIndices,
    boxStart,
    boxEnd,
    shiftHeld,
    onStartVertexDrag,
    onDeleteVertex,
    onAddVertex,
    onStartPan,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let hoveredVertexIndex: number | undefined = $state();
  let hoveredEdgeIndex: number | undefined = $state();

  let R = $derived(6 * invScale);
  let R_hovered = $derived(8 * invScale);
  let R_hit = $derived(8 * invScale);
  let R_edge = $derived(4 * invScale);
  let R_edge_hovered = $derived(6 * invScale);
  let R_edge_hit = $derived(8 * invScale);
  let R_dot = $derived(2 * invScale);
  let S_line = $derived(2 * invScale);

  let vertexHandles = $derived(polygonVertexHandles(vertices));
  let edgeMidpoints = $derived(polygonEdgeMidpoints(vertices));
</script>

<!-- Edge midpoint handles -->
{#each edgeMidpoints as point, i (i)}
  {@const isHovered = hoveredEdgeIndex === i}
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={isHovered ? R_edge_hovered : R_edge}
    fill={color}
    fill-opacity={isHovered ? 0.5 : 0.2}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_edge_hit}
    fill="transparent"
    style:outline="none"
    style:cursor={isEditing ? "default" : "copy"}
    onmouseenter={() => (hoveredEdgeIndex = i)}
    onmouseleave={() => (hoveredEdgeIndex = undefined)}
    onmousedown={(e) => { e.stopPropagation(); onAddVertex(i); }}
  />
{/each}

<!-- Vertex handles -->
{#each vertexHandles as point, i (i)}
  {@const isHovered = hoveredVertexIndex === i}
  {@const isSelected = selectedIndices.has(i)}
  {@const curR = isHovered || isSelected ? R_hovered : R}
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={curR}
    fill={color}
    fill-opacity={isSelected ? 0.7 : isHovered ? 0.5 : 0.25}
    stroke={color}
    stroke-width={isSelected ? S_line * 2 : S_line}
    pointer-events="none"
  />
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_dot}
    fill={color}
    pointer-events="none"
  />
  {#if isSelected}
    <circle
      cx={point[0] * w}
      cy={point[1] * h}
      r={R_hovered + 3 * invScale}
      fill="none"
      stroke={color}
      stroke-width={1.5}
      stroke-dasharray="3,2"
      vector-effect="non-scaling-stroke"
      pointer-events="none"
    />
  {/if}
  <!-- Minus icon when Shift+hover (delete mode) -->
  {#if isHovered && shiftHeld}
    <line
      x1={(point[0] * w) - R_dot}
      y1={point[1] * h}
      x2={(point[0] * w) + R_dot}
      y2={point[1] * h}
      stroke={color}
      stroke-width={S_line * 2}
      stroke-linecap="round"
      pointer-events="none"
    />
  {/if}
  <!-- Hit zone -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_hit}
    fill="transparent"
    style:outline="none"
    style:cursor={shiftHeld ? removeCursorCss : isEditing ? "none" : "move"}
    onmouseenter={() => (hoveredVertexIndex = i)}
    onmouseleave={() => (hoveredVertexIndex = undefined)}
    onmousedown={(e) => { e.stopPropagation(); if (e.shiftKey) onDeleteVertex(i); else onStartVertexDrag(i); }}
  />
{/each}

<!-- Box selection overlay -->
{#if boxStart && boxEnd}
  <BoxSelector start={boxStart} end={boxEnd} {color} />
{/if}
