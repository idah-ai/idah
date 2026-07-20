<script lang="ts">
  import { media } from "$lib/state/media.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  let { canvas = $bindable(), element = $bindable() }: { canvas?: HTMLCanvasElement; element?: HTMLDivElement } =
    $props();
</script>

<!--
  Visible presentation surface. Lives inside the zoomable Viewport target so it
  pans/scales with annotations; the hidden <video> (Video.svelte) sits outside
  the transform and pushes frames here via drawImage. Backing store matches the
  media dimensions, so zoom upscales this raster as it did the <video>.
-->
<div class="video-wrapper" style="width: {media.width}px; height: {media.height}px;" bind:this={element}>
  {#if !viewport.video.hasRenderedFrame}
    <!-- Spinner, not a play glyph — that would read as clickable. Leaves the
         DOM entirely (animation included) once the first frame lands. -->
    <div class="video-placeholder">
      <div class="video-placeholder-spinner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" opacity="0.2" />
          <path d="M12 2a10 10 0 0 1 8.66 5" />
        </svg>
      </div>
    </div>
  {/if}

  <canvas
    class={["video-canvas", ui.renderMode === "nearest-neighbor" ? "nearest" : ""].join(" ")}
    width={media.width}
    height={media.height}
    bind:this={canvas}
  ></canvas>
</div>

<style>
  .video-canvas {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
  }

  .video-canvas.nearest {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .video-wrapper {
    position: relative;
    background-color: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Dark player surface, shown until the first frame is drawn (the canvas above
     stays transparent until then). */
  .video-placeholder {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #33383f 0%, #22262c 100%);
  }

  /* Sized relative to the media so it scales with zoom. Rotates via transform
     only — compositor-driven, no main-thread paint while HLS parses. */
  .video-placeholder-spinner {
    position: relative;
    width: 9%;
    min-width: 48px;
    max-width: 160px;
    aspect-ratio: 1;
    color: rgba(255, 255, 255, 0.85);
    will-change: transform;
    animation: placeholder-spin 0.9s linear infinite;
  }

  .video-placeholder-spinner svg {
    width: 100%;
    height: 100%;
  }

  @keyframes placeholder-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .video-placeholder-spinner {
      animation: none;
    }
  }
</style>
