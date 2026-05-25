<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { polygonVertexHandles, polygonEdgeMidpoints, polygonCentroid, scaleCursorSVG } from "./utils";
  import BoxSelector from "./_BoxSelector.svelte";
  import removeCursorSvg from "$lib/assets/icons/remove-cursor.svg?raw";
  import addCursorSvg from "$lib/assets/icons/add-cursor.svg?raw";

  const removeCursorCss = `url("data:image/svg+xml,${encodeURIComponent(removeCursorSvg)}") 2 2,pointer`;
  const addCursorCss = `url("data:image/svg+xml,${encodeURIComponent(addCursorSvg)}") 2 2,pointer`;

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
    onStartScale: () => void;
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
    onStartScale,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let hoveredVertexIndex: number | undefined = $state();
  let hoveredEdgeIndex: number | undefined = $state();
  let hoveredScale: boolean = $state(false);

  let R = $derived(6 * invScale);
  let R_hovered = $derived(8 * invScale);
  let R_hit = $derived(8 * invScale);
  let R_edge = $derived(3 * invScale);
  let R_edge_hovered = $derived(6 * invScale);
  let R_edge_hit = $derived(8 * invScale);
  let R_dot = $derived(2.5 * invScale);
  let S_line = $derived(2 * invScale);

  // Scale handle sizes
  let R_scale = $derived(6 * invScale);
  let R_scale_hovered = $derived(8 * invScale);
  let R_scale_hit = $derived(8 * invScale);
  let R_scale_dot = $derived(2 * invScale);

  let vertexHandles = $derived(polygonVertexHandles(vertices));
  let edgeMidpoints = $derived(polygonEdgeMidpoints(vertices));
  let centroid = $derived(polygonCentroid(vertices));
</script>

<!-- Edge midpoint handles (diamond shape) -->
{#each edgeMidpoints as point, i (i)}
  {@const isHovered = hoveredEdgeIndex === i}
  {@const cx = point[0] * w}
  {@const cy = point[1] * h}
  {@const r = isHovered ? R_edge_hovered : R_edge}
  <polygon
    points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
    fill="grey"
    stroke="white"
    stroke-width={S_line}
    stroke-linejoin="round"
    pointer-events="none"
  />
  <polygon
    points={`${cx},${cy - R_edge_hit} ${cx + R_edge_hit},${cy} ${cx},${cy + R_edge_hit} ${cx - R_edge_hit},${cy}`}
    fill="transparent"
    style:outline="none"
    style:cursor={isEditing ? "default" : addCursorCss}
    onmouseenter={() => (hoveredEdgeIndex = i)}
    onmouseleave={() => (hoveredEdgeIndex = undefined)}
    onmousedown={(e) => {
      e.stopPropagation();
      onAddVertex(i);
    }}
  />
{/each}

<!-- Vertex handles -->
{#each vertexHandles as point, i (i)}
  {@const isHovered = hoveredVertexIndex === i}
  {@const isSelected = selectedIndices.has(i)}
  {@const curR = isHovered || isSelected ? R_hovered : R}
  <!-- White halo for contrast -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={isHovered || isSelected ? R_hovered : R}
    fill="white"
    fill-opacity={isHovered ? 0.8 : 0.6}
    pointer-events="none"
  />
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
  <circle cx={point[0] * w} cy={point[1] * h} r={R_dot} fill={color} pointer-events="none" />
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
      x1={point[0] * w - R_dot}
      y1={point[1] * h}
      x2={point[0] * w + R_dot}
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
    onmousedown={(e) => {
      e.stopPropagation();
      if (e.shiftKey) onDeleteVertex(i);
      else onStartVertexDrag(i);
    }}
  />
{/each}

<!-- Scale handle at centroid -->
<!-- White halo for contrast -->
<circle
  cx={centroid[0] * w}
  cy={centroid[1] * h}
  r={hoveredScale ? R_scale_hovered : R_scale}
  fill="white"
  fill-opacity={hoveredScale ? 0.8 : 0.6}
  pointer-events="none"
/>
<circle
  cx={centroid[0] * w}
  cy={centroid[1] * h}
  r={hoveredScale ? R_scale_hovered : R_scale}
  fill={color}
  fill-opacity={hoveredScale ? 0.4 : 0.2}
  stroke={color}
  stroke-width={S_line}
  pointer-events="none"
/>
<circle cx={centroid[0] * w} cy={centroid[1] * h} r={R_scale_dot} fill={color} pointer-events="none" />
<circle
  cx={centroid[0] * w}
  cy={centroid[1] * h}
  r={R_scale_hit}
  fill="transparent"
  style:outline="none"
  style:cursor={isEditing ? "none" : `url('${scaleCursorSVG("black")}') 18 18, nesw-resize`}
  onmouseenter={() => (hoveredScale = true)}
  onmouseleave={() => (hoveredScale = false)}
  onmousedown={(e) => {
    e.stopPropagation();
    onStartScale();
  }}
/>

<!-- Box selection overlay -->
{#if boxStart && boxEnd}
  <BoxSelector start={boxStart} end={boxEnd} {color} />
{/if}
