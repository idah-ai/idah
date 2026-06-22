<script lang="ts">
  // ---------------------------------------------------------------------------
  // _CircleHandler.svelte — Interactive handles for the Circle shape
  //
  // Renders a center point handle for panning and an invisible wide stroke
  // along the circle edge for hover detection. The whole edge highlights on
  // hover to show interactivity.
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { Point } from "$lib/utils/math/point";

  type Props = {
    center: Point;
    displayRadius: number;
    color: string;
    isEditing: boolean;
    onStartResize: () => void;
    onStartPan: () => void;
  };

  let {
    center,
    displayRadius,
    color,
    isEditing,
    onStartResize,
    onStartPan,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let hoveredEdge: boolean = $state(false);
  let hoveredCenter: boolean = $state(false);

  let R_center = $derived(5 * invScale);
  let R_center_hovered = $derived(7 * invScale);
  let R_center_hit = $derived(8 * invScale);
  let R_dot = $derived(2.5 * invScale);
  let S_line = $derived(2 * invScale);
</script>

<!-- Invisible wide edge for hover + resize drag initiation -->
<circle
  cx={center[0] * w}
  cy={center[1] * h}
  r={displayRadius * Math.min(w, h)}
  fill="none"
  stroke="transparent"
  stroke-width={24}
  style:outline="none"
  vector-effect="non-scaling-stroke"
  style:cursor={isEditing ? "none" : hoveredEdge ? "pointer" : "default"}
  onmouseenter={() => (hoveredEdge = true)}
  onmouseleave={() => (hoveredEdge = false)}
  onmousedown={(e) => {
    e.stopPropagation();
    onStartResize();
  }}
/>

<!-- Visible edge highlight ring on hover (shows the whole edge is interactive) -->
{#if hoveredEdge}
  <circle
    cx={center[0] * w}
    cy={center[1] * h}
    r={displayRadius * Math.min(w, h)}
    fill="none"
    stroke={color}
    stroke-width={4 * invScale}
    stroke-opacity={0.5}
    pointer-events="none"
  />
{/if}

<!-- Center handle (for panning) -->
<circle
  cx={center[0] * w}
  cy={center[1] * h}
  r={hoveredCenter ? R_center_hovered : R_center}
  fill="white"
  fill-opacity={hoveredCenter ? 0.8 : 0.6}
  pointer-events="none"
/>
<circle
  cx={center[0] * w}
  cy={center[1] * h}
  r={hoveredCenter ? R_center_hovered : R_center}
  fill={color}
  fill-opacity={hoveredCenter ? 0.4 : 0.2}
  stroke={color}
  stroke-width={S_line}
  pointer-events="none"
/>
<circle cx={center[0] * w} cy={center[1] * h} r={R_dot} fill={color} pointer-events="none" />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<circle
  cx={center[0] * w}
  cy={center[1] * h}
  r={R_center_hit}
  fill="transparent"
  style:outline="none"
  style:cursor={isEditing ? "none" : "grab"}
  onmouseenter={() => (hoveredCenter = true)}
  onmouseleave={() => (hoveredCenter = false)}
  onmousedown={(e) => {
    e.stopPropagation();
    onStartPan();
  }}
/>
