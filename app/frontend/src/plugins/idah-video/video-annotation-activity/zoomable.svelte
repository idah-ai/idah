<script lang="ts">
  import { type Snippet } from "svelte";
  import { HEIGHT, WIDTH, X, Y, type Point } from "./VideoAnnotationContext";
  import { DefaultMode, IdahVideoBoundingBox } from "../type";

  let offset: Point = $state([0, 0]);
  let size: Point = $state([0, 0]);
  let zoom = $state({
    current: 1,
    min: 0.4,
    max: 100,
    step: 0.1,
  });

  let {
    mode,
    children,
    onZoomChange,
  }: {
    mode: string;
    children: Snippet;
    onZoomChange: (scale: number, offset: Point) => void;
  } = $props();

  $effect(() => {
    // eslint-disable-next-line  @typescript-eslint/no-unused-expressions
    size[HEIGHT] && size[WIDTH];
    onZoomChange(zoom.current, offset);
  });

  let panOrigin: Point | undefined = $state();

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
    console.log("zoomin");
  }
  export function zoomOut() {
    console.log("zoomout");
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
    let step;

    switch (mode) {
      default:
        step = e.deltaY > 0 ? -zoom.step : zoom.step;

        zoomAt(e.offsetX, e.offsetY, step * zoom.current);
    }
  }

  export function mouseDown(e: MouseEvent) {
    switch (mode) {
      default:
        if (!panOrigin) {
          panStart(e.offsetX, e.offsetY);
        }
        break;
    }
  }

  export function mouseUp(_e: MouseEvent) {
    switch (mode) {
      default:
        panStop();
        break;
    }
  }

  export function mouseMove(e: MouseEvent) {
    switch (mode) {
      case DefaultMode:
      case IdahVideoBoundingBox:
      default:
        panTo(e.offsetX, e.offsetY);
    }
  }
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
    position: absolute;
    display: flexbox;
    overflow: hidden;
  }
  .target {
    background-color: chartreuse;
  }
</style>
