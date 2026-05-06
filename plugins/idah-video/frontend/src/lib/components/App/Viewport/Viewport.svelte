<script lang="ts">
  import { type Snippet } from "svelte";

  import { DEFAULT_MODE, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX } from "$lib/plugin/type";
  import {
    HEIGHT,
    WIDTH,
    X,
    Y,
    type Point,
  } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
  import { currentMode } from "$lib/plugin/video-annotation-activity/store/store";
  import { viewport } from "$lib/state/viewport.svelte";

  // Props
  interface Props {
    children: Snippet;
    onPanStart?: () => void;
    onPanStop?: () => void;
  }
  let { children, onPanStart, onPanStop }: Props = $props();

  // Variables
  let size: Point = $state([0, 0]);
  let panOrigin: Point | undefined = $state();

  /** Zoom delta accumulator for smooth touchpad / mouse wheel zooming. */
  let zoomAccumulator = 0;

  // Functions
  function panTo(x: number, y: number) {
    if (!panOrigin) return;

    viewport.workspace.transform.translate = [x - panOrigin[X], y - panOrigin[Y]];
  }

  function panStart(x: number, y: number) {
    panOrigin = [x - viewport.workspace.transform.translate[X], y - viewport.workspace.transform.translate[Y]];
  }

  function panStop() {
    panOrigin = undefined;
  }

  export function zoomIn() {
    const curScale = viewport.workspace.transform.scale;
    const curTranslate = viewport.workspace.transform.translate;
    let [ox, oy] = curTranslate;
    let [sx, sy] = size;
    ox = curTranslate[X] / curScale;
    oy = curTranslate[Y] / curScale;

    let dsx = sx - (sx * scopedZoom(curScale + 0.1)) / curScale;
    let dsy = sy - (sy * scopedZoom(curScale + 0.1)) / curScale;
    setZoom(curScale + 0.1);
    setOffset([ox * viewport.workspace.transform.scale + dsx / 2, oy * viewport.workspace.transform.scale + dsy / 2]);
  }

  export function zoomOut() {
    const curScale = viewport.workspace.transform.scale;
    const curTranslate = viewport.workspace.transform.translate;
    let [ox, oy] = curTranslate;
    let [sx, sy] = size;
    ox = curTranslate[X] / curScale;
    oy = curTranslate[Y] / curScale;

    let dsx = sx - (sx * scopedZoom(curScale - 0.1)) / curScale;
    let dsy = sy - (sy * scopedZoom(curScale - 0.1)) / curScale;
    setZoom(curScale - 0.1);
    setOffset([ox * viewport.workspace.transform.scale + dsx / 2, oy * viewport.workspace.transform.scale + dsy / 2]);
  }

  function scopedZoom(value: number) {
    return Math.max(0.4, Math.min(100, value));
  }

  export function setZoom(newZoom: number) {
    const clamped = Math.max(0.4, Math.min(100, newZoom));
    viewport.workspace.transform.scale = clamped;
  }

  export function setOffset(newOffset: Point) {
    viewport.workspace.transform.translate = newOffset;
  }

  export function onWheel(e: WheelEvent) {
    if ($currentMode === IDAH_NOTE) return;
    e.preventDefault();

    // Touchpad pinch-to-zoom sets ctrlKey on most platforms, or metaKey on Mac.
    // Plain two-finger pan (any direction) and mouse wheel do NOT set ctrlKey.
    const isZoom = e.ctrlKey || e.metaKey;

    if (isZoom) {
      // Pinch zoom: Ctrl/meta + wheel → scale
      // Cap per-tick delta so a single mouse tick doesn't over-zoom,
      // while touchpad's many small deltas accumulate naturally.
      zoomAccumulator += Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 40);

      const THRESHOLD = 15;
      const steps = Math.trunc(zoomAccumulator / THRESHOLD);
      if (steps !== 0) {
        zoomAccumulator -= steps * THRESHOLD;

        const curScale = viewport.workspace.transform.scale;
        const curTranslate = viewport.workspace.transform.translate;

        // steps > 0 (deltaY > 0) → pinch in  → zoom in  (scale increases)
        // steps < 0 (deltaY < 0) → pinch out → zoom out (scale decreases)
        const factor = Math.pow(1.05, steps);
        const newScale = Math.max(0.4, Math.min(100, curScale * factor));

        if (Math.abs(newScale - curScale) < 0.001) return;

        // Zoom towards the cursor position
        let ox = (e.offsetX - curTranslate[X]) / curScale;
        let oy = (e.offsetY - curTranslate[Y]) / curScale;
        viewport.workspace.transform.translate = [e.offsetX - ox * newScale, e.offsetY - oy * newScale];
        viewport.workspace.transform.scale = newScale;
      }
    } else {
      // Scroll / two-finger drag → translate
      const curTranslate = viewport.workspace.transform.translate;
      viewport.workspace.transform.translate = [
        curTranslate[X] - e.deltaX,
        curTranslate[Y] - e.deltaY,
      ];
    }
  }

  export function mouseDown(e: MouseEvent) {
    switch ($currentMode) {
      case IDAH_NOTE: {
        break; // Do not pan in note mode
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
    switch ($currentMode) {
      case IDAH_NOTE: {
        break; // Do not pan in note mode
      }

      case DEFAULT_MODE:
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
  bind:clientHeight={size[HEIGHT]}
  bind:clientWidth={size[WIDTH]}
>
  <div
    class="target"
    style:transform-origin="top left"
    style:transform={`translate(${viewport.workspace.transform.translate[X]}px, ${viewport.workspace.transform.translate[Y]}px)  scale(${viewport.workspace.transform.scale})`}
  >
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: absolute;
    display: flexbox;
    overflow: hidden;
  }
</style>
