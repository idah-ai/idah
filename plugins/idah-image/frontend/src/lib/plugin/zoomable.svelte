<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { HEIGHT, WIDTH, X, Y, type Point } from "$lib/context/image-annotation-context";
  import { currentMode } from "$lib/plugin/store/store";
  import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_NOTE } from "$lib/plugin/types";

  // Props
  interface Props {
    children: Snippet;
    target_container: () => HTMLImageElement | undefined;
    onZoomChange: (scale: number, offset: Point) => void;
  }
  let { children, target_container, onZoomChange }: Props = $props();

  // Variables
  let offset: Point = $state([0, 0]);
  let size: Point = $state([0, 0]);
  let panOrigin: Point | undefined = $state();
  let zoom = $state({
    current: 1,
    min: 0.4,
    max: 100,
    step: 0.1,
  });

  $effect(() => {
    onZoomChange(zoom.current, offset);
  });

  // Functions
  function panTo(x: number, y: number) {
    if (!panOrigin) return;

    offset = [x - panOrigin[X], y - panOrigin[Y]];
  }

  function panStart(x: number, y: number) {
    panOrigin = [x - offset[X], y - offset[Y]];
  }

  function panStop() {
    panOrigin = undefined;
  }

  export function zoomIn() {
    let [ox, oy] = offset;
    let [sx, sy] = size;
    ox = offset[X] / zoom.current;
    oy = offset[Y] / zoom.current;

    let dsx = sx - (sx * scopedZoom(zoom.current + zoom.step)) / zoom.current;
    let dsy = sy - (sy * scopedZoom(zoom.current + zoom.step)) / zoom.current;
    setZoom(zoom.current + zoom.step);
    setOffset([ox * zoom.current + dsx / 2, oy * zoom.current + dsy / 2]);
  }

  export function zoomOut() {
    let [ox, oy] = offset;
    let [sx, sy] = size;
    ox = offset[X] / zoom.current;
    oy = offset[Y] / zoom.current;

    let dsx = sx - (sx * scopedZoom(zoom.current - zoom.step)) / zoom.current;
    let dsy = sy - (sy * scopedZoom(zoom.current - zoom.step)) / zoom.current;
    setZoom(zoom.current - zoom.step);
    setOffset([ox * zoom.current + dsx / 2, oy * zoom.current + dsy / 2]);
  }

  function scopedZoom(value: number) {
    return Math.max(zoom.min, Math.min(zoom.max, value));
  }

  export function setZoom(newZoom: number) {
    zoom = { ...zoom, current: scopedZoom(newZoom) };
  }

  export function setOffset(newOffset: Point) {
    offset = newOffset;
  }

  function zoomAt(x: number, y: number, step: number) {
    let ox = (x - offset[X]) / zoom.current;
    let oy = (y - offset[Y]) / zoom.current;
    let scale_to = parseFloat(Math.min(Math.max(zoom.min, zoom.current + step), zoom.max).toFixed(1));
    let offset_to: Point = [x - ox * scale_to, y - oy * scale_to];

    offset = offset_to;
    zoom = { ...zoom, current: scale_to };
  }

  export function onWheel(e: WheelEvent) {
    let step = e.deltaY > 0 ? -zoom.step : zoom.step;

    switch ($currentMode) {
      case IMAGE_NOTE: {
        break; // Do not zoom in note mode
      }
      default: {
        zoomAt(e.offsetX, e.offsetY, step * zoom.current);
      }
    }
  }

  export function mouseDown(e: MouseEvent) {
    switch ($currentMode) {
      case IMAGE_NOTE: {
        break; // Do not pan in note mode
      }
      default:
        if (!panOrigin) {
          panStart(e.offsetX, e.offsetY);
        }
        break;
    }
  }

  export function mouseUp(_e: MouseEvent) {
    switch ($currentMode) {
      case IMAGE_NOTE: {
        break; // Do not pan in note mode
      }
      default: {
        panStop();
        break;
      }
    }
  }

  export function mouseMove(e: MouseEvent) {
    switch ($currentMode) {
      case IMAGE_NOTE: {
        break; // Do not pan in note mode
      }

      case DEFAULT_MODE:
      case IMAGE_BOUNDING_BOX:
      case "bounding-polygon":
      default: {
        panTo(e.offsetX, e.offsetY);
      }
    }
  }

  // set image center
  function setCenterOffset(imgEl: HTMLImageElement | undefined) {
    if (!imgEl) return;
    const containerWidth = size[WIDTH];
    const containerHeight = size[HEIGHT];

    const imageWidth = imgEl.clientWidth;
    const imageHeight = imgEl.clientHeight;

    const offsetX = (containerWidth - imageWidth) / 2;
    const offsetY = (containerHeight - imageHeight) / 2;

    setOffset([offsetX, offsetY]);
  }

  // Lifecycle
  onMount(() => {
    const imgEl = target_container?.();
    if (!imgEl) return;

    function onElementLoaded() {
      setCenterOffset(imgEl);
    }

    if (imgEl.complete) {
      onElementLoaded();
    } else {
      imgEl.addEventListener("load", onElementLoaded, { once: true });
    }

    return () => {
      imgEl.removeEventListener("load", onElementLoaded);
    };
  });
</script>

<div
  class="zoomable bg-secondary h-full w-full"
  role="grid"
  tabindex="-1"
  bind:clientHeight={size[HEIGHT]}
  bind:clientWidth={size[WIDTH]}
>
  <div
    class="target"
    style:transform-origin="top left"
    style:transform={`translate(${offset[X]}px, ${offset[Y]}px)  scale(${zoom.current})`}
  >
    {@render children()}
  </div>
</div>

<style>
  .zoomable {
    position: relative;
    display: flex;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }

  .target {
    width: fit-content;
    height: fit-content;
  }
</style>
