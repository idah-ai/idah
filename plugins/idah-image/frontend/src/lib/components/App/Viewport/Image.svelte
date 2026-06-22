<script lang="ts">
  import { onMount } from "svelte";

  import { media } from "$lib/state/media.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  let { src = undefined, element = $bindable(), onResize = () => {} } = $props();

  // ── Element refs ──────────────────────────────────────────────────
  let imageElement: HTMLImageElement;

  onMount(() => {
    imageElement.addEventListener("resize", () => onResize());
  });
</script>

<div class="image-wrapper" style="width: {media.width}px; height: {media.height}px;" bind:this={element}>
  <img
    id="idah-image"
    bind:this={imageElement}
    {src}
    alt=""
    class={["image-element", ui.renderMode === "nearest-neighbor" ? "nearest" : ""].join(" ")}
    onload={() => {
      // Image loaded — container layout is now final. Re-fit.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          viewport.workspace.fitToViewport();
        });
      });
    }}
  />
</div>

<style>
  .image-element {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
    object-fit: fill;
  }

  .image-element.nearest,
  .placeholder-image.nearest {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .image-wrapper {
    position: relative;
    background-color: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }
</style>
