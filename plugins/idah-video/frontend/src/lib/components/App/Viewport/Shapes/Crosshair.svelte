<script lang="ts">
  // ---------------------------------------------------------------------------
  // Crosshair.svelte — Red crosshair overlay for build modes
  //
  // Renders two perpendicular lines crossing at the current scene mouse position.
  // Shown during bounding-box and polygon creation modes.
  // ---------------------------------------------------------------------------

  import type { Point } from "$lib/utils/math/point";

  type Props = {
    cursor: Point;
    visible: boolean;
  };

  let { cursor, visible }: Props = $props();
</script>

{#if visible}
  <line
    x1={cursor[0] - 10000}
    y1={cursor[1]}
    x2={cursor[0] + 10000}
    y2={cursor[1]}
    stroke="rgba(255, 59, 48, 0.9)"
    stroke-width="1"
  />
  <line
    x1={cursor[0]}
    y1={cursor[1] - 10000}
    x2={cursor[0]}
    y2={cursor[1] + 10000}
    stroke="rgba(255, 59, 48, 0.9)"
    stroke-width="1"
  />
{/if}
