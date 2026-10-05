<script lang="ts">
  import { media } from "$lib/state/media.svelte";
  import { ui } from "$lib/state/ui.svelte";
</script>

<svg
  class="grid-overlay"
  width={media.width}
  height={media.height}
  style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2;"
>
  {#if ui.gridEnabled && ui.gridSize >= 5}
    <defs>
      <pattern
        id="video-grid-pattern"
        width={ui.gridSize}
        height={ui.gridSize}
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M {ui.gridSize} 0 L {ui.gridSize} {ui.gridSize} M 0 {ui.gridSize} L {ui.gridSize} {ui.gridSize}"
          stroke="rgba(255, 255, 255, {ui.gridOpacity / 100 * 0.5})"
          stroke-width="1"
          fill="none"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#video-grid-pattern)" />
  {/if}
</svg>