<script lang="ts">
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { polygonVertexHandles, polygonEdgeMidpoints } from "./utils";

  type Props = {
    vertices: Point[];
    color: string;
    isEditing: boolean;
    onStartVertexDrag: (vertexIndex: number) => void;
    onAddVertex: (edgeIndex: number) => void;
    onStartPan: () => void;
  };

  let {
    vertices,
    color,
    isEditing,
    onStartVertexDrag,
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

<!-- Edge midpoint handles — click to add a vertex -->
{#each edgeMidpoints as point, i (i)}
  {@const isHovered = hoveredEdgeIndex === i}
  <!-- Visible dot -->
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
  <!-- Transparent hit zone -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_edge_hit}
    fill="transparent"
    style:outline="none"
    style:cursor={isEditing ? "default" : "copy"}
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
  {@const curR = isHovered ? R_hovered : R}
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={curR}
    fill={color}
    fill-opacity={isHovered ? 0.5 : 0.25}
    stroke={color}
    stroke-width={S_line}
    pointer-events="none"
  />
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_dot}
    fill={color}
    pointer-events="none"
  />
  <!-- Transparent hit zone -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_hit}
    fill="transparent"
    style:outline="none"
    style:cursor={isEditing ? "none" : "move"}
    onmouseenter={() => (hoveredVertexIndex = i)}
    onmouseleave={() => (hoveredVertexIndex = undefined)}
    onmousedown={(e) => {
      e.stopPropagation();
      onStartVertexDrag(i);
    }}
  />
{/each}
