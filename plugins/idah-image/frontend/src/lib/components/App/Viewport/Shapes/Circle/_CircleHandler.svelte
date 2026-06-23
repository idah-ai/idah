<script lang="ts">
  // ---------------------------------------------------------------------------
  // _CircleHandler.svelte — Interactive handles for the Circle shape
  //
  // Renders a center point handle that triggers a scale bar for resizing the
  // circle radius (same pattern as Polygon's centroid scale).
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { scaleCursorSVG } from "../Polygon/utils";

  import type { Point } from "$lib/utils/math/point";

  type Props = {
    center: Point;
    color: string;
    isEditing: boolean;
    onStartScale: () => void;
  };

  let {
    center,
    color,
    isEditing,
    onStartScale,
  }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let hoveredCenter: boolean = $state(false);

  let R_center = $derived(6 * invScale);
  let R_center_hovered = $derived(8 * invScale);
  let R_center_hit = $derived(8 * invScale);
  let R_dot = $derived(2.5 * invScale);
  let S_line = $derived(2 * invScale);
</script>

<!-- Center handle (initiates scale bar on drag) -->
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
  style:cursor={isEditing ? "none" : `url('${scaleCursorSVG("black")}') 12 12, nesw-resize`}
  onmouseenter={() => (hoveredCenter = true)}
  onmouseleave={() => (hoveredCenter = false)}
  onmousedown={(e) => {
    e.stopPropagation();
    onStartScale();
  }}
/>
