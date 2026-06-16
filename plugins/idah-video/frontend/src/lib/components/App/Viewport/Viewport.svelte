<script lang="ts">
  import { type Snippet } from "svelte";

  import { viewport, VIEWPORT_MAX_ZOOM, VIEWPORT_MIN_ZOOM } from "$lib/state/viewport.svelte";
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX } from "$lib/types";
  import { modKey } from "$lib/utils/browser";

  import SyncIndicator from "./SyncIndicator.svelte";

  import { type Point } from "$lib/utils/math/point";

  // Props
  interface Props {
    children: Snippet;
    onPanStart?: () => void;
    onPanStop?: () => void;
  }
  let { children, onPanStart, onPanStop }: Props = $props();

  // Variables
  let size: Point = $state([0, 0]);
  let sizeElement: HTMLDivElement;
  let panOrigin: Point | undefined = $state();

  /** Zoom delta accumulator for smooth touchpad / mouse wheel zooming. */
  let zoomAccumulator = 0;

  // Functions
  function panTo(x: number, y: number) {
    if (!panOrigin) return;

    viewport.workspace.transform.translate = [x - panOrigin[0], y - panOrigin[1]];
    viewport.workspace.clampTranslate();
  }

  function panStart(offsetX: number, offsetY: number) {
    panOrigin = [
      offsetX - viewport.workspace.transform.translate[0],
      offsetY - viewport.workspace.transform.translate[1],
    ];
    // Track mouse at document level during drag so we don't lose it outside the viewport
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
  }

  function panStop() {
    panOrigin = undefined;
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
  }

  function onDocMouseMove(e: MouseEvent) {
    if (!panOrigin) return;
    // Convert client coords to element-relative using the element's bounding rect
    const rect = sizeElement.getBoundingClientRect();
    viewport.workspace.transform.translate = [
      e.clientX - rect.left - panOrigin[0],
      e.clientY - rect.top - panOrigin[1],
    ];
    viewport.workspace.clampTranslate();
  }

  function onDocMouseUp(_e: MouseEvent) {
    if (panOrigin) {
      panStop();
      onPanStop?.();
    }
  }

  export function zoomIn() {
    const curScale = viewport.workspace.transform.scale;
    const curTranslate = viewport.workspace.transform.translate;
    let [ox, oy] = curTranslate;
    let [sx, sy] = size;
    ox = curTranslate[0] / curScale;
    oy = curTranslate[1] / curScale;

    let dsx = sx - (sx * scopedZoom(curScale + 0.1)) / curScale;
    let dsy = sy - (sy * scopedZoom(curScale + 0.1)) / curScale;
    setZoom(curScale + 0.1);
    setOffset([ox * viewport.workspace.transform.scale + dsx / 2, oy * viewport.workspace.transform.scale + dsy / 2]);
    viewport.workspace.clampTranslate();
  }

  export function zoomOut() {
    const curScale = viewport.workspace.transform.scale;
    const curTranslate = viewport.workspace.transform.translate;
    let [ox, oy] = curTranslate;
    let [sx, sy] = size;
    ox = curTranslate[0] / curScale;
    oy = curTranslate[1] / curScale;

    let dsx = sx - (sx * scopedZoom(curScale - 0.1)) / curScale;
    let dsy = sy - (sy * scopedZoom(curScale - 0.1)) / curScale;
    setZoom(curScale - 0.1);
    setOffset([ox * viewport.workspace.transform.scale + dsx / 2, oy * viewport.workspace.transform.scale + dsy / 2]);
    viewport.workspace.clampTranslate();
  }

  function scopedZoom(value: number) {
    return Math.max(VIEWPORT_MIN_ZOOM, Math.min(VIEWPORT_MAX_ZOOM, value));
  }

  export function setZoom(newZoom: number) {
    const clamped = Math.max(VIEWPORT_MIN_ZOOM, Math.min(VIEWPORT_MAX_ZOOM, newZoom));
    viewport.workspace.transform.scale = clamped;
  }

  export function setOffset(newOffset: Point) {
    viewport.workspace.transform.translate = newOffset;
  }

  /**
   * Converts a WheelEvent delta to pixels.
   * Linux/Windows mouse wheels typically use DOM_DELTA_LINE (mode 1) with small
   * integer values (e.g. 3), which would be imperceptible without this conversion.
   */
  function normalizeWheelDelta(delta: number, deltaMode: number): number {
    if (deltaMode === 1 /* DOM_DELTA_LINE */) return delta * 40;
    if (deltaMode === 2 /* DOM_DELTA_PAGE */) return delta * size[1];
    return delta; // DOM_DELTA_PIXEL — already in pixels
  }

  export function onWheel(e: WheelEvent) {
    if (viewport.mode === "note") return;
    e.preventDefault();

    // Touchpad pinch-to-zoom sets ctrlKey on most platforms, or metaKey on Mac.
    // Plain two-finger pan (any direction) and mouse wheel do NOT set ctrlKey.
    const isZoom = modKey(e);

    if (isZoom) {
      // Pinch zoom: Ctrl/meta + wheel → scale
      // Cap per-tick delta so a single mouse tick doesn't over-zoom,
      // while touchpad's many small deltas accumulate naturally.
      zoomAccumulator += Math.sign(-e.deltaY) * Math.min(Math.abs(e.deltaY), 40);

      const THRESHOLD = 15;
      const steps = Math.trunc(zoomAccumulator / THRESHOLD);
      if (steps !== 0) {
        zoomAccumulator -= steps * THRESHOLD;

        const curScale = viewport.workspace.transform.scale;
        const curTranslate = viewport.workspace.transform.translate;

        // steps > 0 (deltaY < 0) → pinch out → zoom out (scale decreases)
        // steps < 0 (deltaY > 0) → pinch in  → zoom in  (scale increases)
        const factor = Math.pow(1.05, steps);
        const newScale = Math.max(VIEWPORT_MIN_ZOOM, Math.min(VIEWPORT_MAX_ZOOM, curScale * factor));

        if (Math.abs(newScale - curScale) < 0.001) return;

        // Zoom towards the cursor position
        let ox = (e.offsetX - curTranslate[0]) / curScale;
        let oy = (e.offsetY - curTranslate[1]) / curScale;
        viewport.workspace.transform.translate = [e.offsetX - ox * newScale, e.offsetY - oy * newScale];
        viewport.workspace.transform.scale = newScale;
        viewport.workspace.clampTranslate();
      }
    } else {
      // Scroll / two-finger drag → translate.

      // Normalise deltas to pixels first — on Linux and Windows a standard mouse
      let dx = normalizeWheelDelta(e.deltaX, e.deltaMode);
      let dy = normalizeWheelDelta(e.deltaY, e.deltaMode);

      // macOS natively swaps deltaX/deltaY when Shift is held (vertical wheel →
      // horizontal pan). Windows/Linux do NOT — we must handle it here so
      // Shift+wheel consistently provides horizontal panning across platforms.
      if (e.shiftKey && dx === 0 && dy !== 0) {
        dx = dy;
        dy = 0;
      }

      const curTranslate = viewport.workspace.transform.translate;
      viewport.workspace.transform.translate = [curTranslate[0] - dx, curTranslate[1] - dy];
      viewport.workspace.clampTranslate();
    }
  }

  export function mouseDown(e: MouseEvent) {
    switch (viewport.mode) {
      case "note": {
        break; // Do not pan — handled by ShapesContainer
      }
      default:
        if (!panOrigin) {
          panStart(e.offsetX, e.offsetY);
          onPanStart?.();
        }
        break;
    }
  }

  export function mouseUp(_e: MouseEvent) {
    if (panOrigin) {
      panStop();
      onPanStop?.();
    }
  }

  export function mouseMove(e: MouseEvent) {
    switch (viewport.mode) {
      case "note": {
        break; // Do not pan in note mode
      }

      case "default":
      case IDAH_VIDEO_BOUNDING_BOX:
      case "bounding-polygon":
      default: {
        panTo(e.offsetX, e.offsetY);
      }
    }
  }
</script>

<div
  class="viewport bg-secondary h-full w-full"
  role="grid"
  tabindex="-1"
  bind:this={sizeElement}
  bind:clientHeight={size[1]}
  bind:clientWidth={size[0]}
>
  <SyncIndicator />
  <div
    class="target"
    style:transform-origin="top left"
    style:transform={`translate(${viewport.workspace.transform.translate[0]}px, ${viewport.workspace.transform.translate[1]}px)  scale(${viewport.workspace.transform.scale})`}
  >
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: absolute;
    display: flexbox;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }
</style>
