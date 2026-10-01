<script lang="ts">
  import { onMount } from "svelte";

  import { media } from "$lib/state/media.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  let { src = undefined, element = $bindable(), onResize = () => {} } = $props();

  // ── Element refs ──────────────────────────────────────────────────
  let imageElement: HTMLImageElement;

  // ── Gamma correction via SVG filter ─────────────────────────────────
  //
  // CSS has no native gamma() filter, so we use an SVG <feComponentTransfer>
  // and update its exponent reactively via $effect.
  let gammaFilter: SVGFilterElement | undefined;

  $effect(() => {
    if (!gammaFilter) return;
    const exp = Math.max(0.05, ui.imageGamma) / 100;
    const funcs = gammaFilter.querySelectorAll<SVGElement>("feFuncR, feFuncG, feFuncB");
    for (const fn of funcs) {
      fn.setAttribute("exponent", String(exp));
    }
  });

  onMount(() => {
    imageElement.addEventListener("resize", () => onResize());
  });
</script>

<!-- Hidden SVG filter for gamma correction -->
<svg style="display:none" aria-hidden="true">
  <defs>
    <filter id="image-gamma" bind:this={gammaFilter}>
      <feComponentTransfer>
        <feFuncR type="gamma" amplitude="1" exponent="1" offset="0" />
        <feFuncG type="gamma" amplitude="1" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="1" exponent="1" offset="0" />
      </feComponentTransfer>
    </filter>
  </defs>
</svg>

<div class="image-wrapper" style="width: {media.width}px; height: {media.height}px;" bind:this={element}>
  <img
    id="idah-image"
    bind:this={imageElement}
    {src}
    alt=""
    class={["image-element", ui.renderMode === "nearest-neighbor" ? "nearest" : ""].join(" ")}
    style="opacity: {ui.imageOpacity / 100}; filter: contrast({ui.imageContrast / 100}) brightness({ui.imageBrightness / 100}) saturate({ui.imageSaturation / 100}) hue-rotate({(ui.imageHue - 100) * 1.8}deg) url(#image-gamma);"
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
    background-color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }
</style>
