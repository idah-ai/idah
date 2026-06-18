<script lang="ts">
  import type Viewport from "./Viewport.svelte";
  import { EDITOR_MODE, viewport } from "$lib/state/viewport.svelte";

  // ── Props ──────────────────────────────────────────────────────────────
  interface Props {
    zoomableElement: Viewport;
  }
  let { zoomableElement }: Props = $props();

  // ── Visibility ─────────────────────────────────────────────────────────
  let framePending = $derived(viewport.video.framePending);

  // ── Event handlers ─────────────────────────────────────────────────────
  // When framePending is true, this transparent overlay sits above the SVG to
  // block annotation interactions (click, drag, select) while still allowing
  // panning (drag to move the video) and zooming (mouse wheel / pinch zoom).

  function onMouseDown(e: MouseEvent) {
    // Only pan in default mode (same logic as Viewport.mouseDown)
    if (viewport.mode === EDITOR_MODE) {
      zoomableElement.mouseDown(e);
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (viewport.mode === EDITOR_MODE) {
      zoomableElement.mouseMove(e);
    }
  }

  function onMouseUp(e: MouseEvent) {
    zoomableElement.mouseUp(e);
  }

  function onMouseLeave(_e: MouseEvent) {
    zoomableElement.mouseUp(new MouseEvent("mouseup"));
  }

  function onWheel(e: WheelEvent) {
    zoomableElement.onWheel(e);
  }
</script>

{#if framePending}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="frame-pending-overlay"
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onmouseup={onMouseUp}
    onmouseleave={onMouseLeave}
    onwheel={onWheel}
    onkeydown={() => {}}
    role="presentation"
    aria-hidden="true"
  ></div>
{/if}

<style>
  .frame-pending-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: transparent;
    /* Block pointer events from reaching the SVG annotation layer below */
    pointer-events: auto;
  }
</style>
