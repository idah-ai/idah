<script lang="ts">
  // ---------------------------------------------------------------------------
  // _LineHandler.svelte — Interactive handles for the Line shape
  //
  // Renders two endpoint circles (for resizing/dragging). The whole line body
  // handles panning via the invisible wider stroke in LineShape.
  // No midpoint handler — we don't add vertices to a line.
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { Point } from "$lib/utils/math/point";

  type Props = {
    displayPoints: Point[];
    color: string;
    isEditing: boolean;
    onStartResize: (endpointIndex: number) => void;
  };

  let {
    displayPoints,
    color,
    isEditing,
    onStartResize,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let hoveredEndpointIndex: number | undefined = $state();

  let R = $derived(6 * invScale);
  let R_hovered = $derived(8 * invScale);
  let R_hit = $derived(8 * invScale);
  let R_dot = $derived(2.5 * invScale);
  let S_line = $derived(2 * invScale);
</script>

<!-- Endpoint handles -->
{#each displayPoints as point, i (i)}
  {@const isHovered = hoveredEndpointIndex === i}
  {@const curR = isHovered ? R_hovered : R}
  <!-- White halo for contrast -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={isHovered ? R_hovered : R}
    fill="white"
    fill-opacity={isHovered ? 0.8 : 0.6}
    pointer-events="none"
  />
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
  <circle cx={point[0] * w} cy={point[1] * h} r={R_dot} fill={color} pointer-events="none" />
  <!-- Hit zone -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <circle
    cx={point[0] * w}
    cy={point[1] * h}
    r={R_hit}
    fill="transparent"
    style:outline="none"
    style:cursor={isEditing ? "none" : "move"}
    onmouseenter={() => (hoveredEndpointIndex = i)}
    onmouseleave={() => (hoveredEndpointIndex = undefined)}
    onmousedown={(e) => {
      e.stopPropagation();
      onStartResize(i);
    }}
  />
{/each}
