<script lang="ts">
  import { type Snippet } from "svelte";
  import {
    HEIGHT,
    ORIGIN,
    WIDTH,
    X,
    Y,
    type Point,
    type VideoAnnotation,
    type VideoFrameSelection,
    type VideoShape,
  } from "./VideoAnnotationContext";
  import Zoomable from "./zoomable.svelte";
  import BoundingBox, { type ToolSelection } from "./bounding-box.svelte";
  import { boundingBoxes } from "./idb_store.svelte";

  type Props = {
    frame: number;
    selected: VideoAnnotation | undefined;
    mode: string;
    target_container: () => HTMLDivElement; // ..
    annotations_promise: Promise<VideoAnnotation[]>;
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    onSelectAnnotation: (annotation?: VideoAnnotation) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (type: string, frame: number, points?: Point[], id?: string) => void;
    videoResizedAt: Date;
  };

  let {
    frame,
    selected,
    mode,
    target_container,
    annotations_promise,
    onSelectAnnotation,
    onSelection, // valid shape output
    children,
    videoResizedAt,
    ...restProps
  }: Props = $props();
  let zoomInfo: {
    scale: number;
    offset: Point;
  } = $state({
    scale: 1,
    offset: [0, 0],
  });

  let height = $state(0);
  let width = $state(0);
  let mouse: Point = $state([0, 0]);
  let shape: VideoShape | undefined = $derived(
    selected
      ? selected.shape
      : mode != "visual"
        ? {
            type: mode,
            start: frame,
            end: frame,
            frames: [],
          }
        : undefined,
  );
  let points: Point[] = $derived.by(() => {
    return shape ? currentShape(shape, frame) || [] : [];
  });

  function updatedSize(): Point {
    videoResizedAt; // (... update on change)
    let target_dom_rect = target_container()?.getBoundingClientRect();
    zoomInfo; // (... update on change)

    return !target_dom_rect ? ORIGIN : [target_dom_rect.width, target_dom_rect.height];
  }

  let target_size: Point = $derived.by(updatedSize);

  let cursor = $derived([mouse[X] - zoomInfo.offset[X], mouse[Y] - zoomInfo.offset[Y]]);

  let target: Point = $derived([
    Math.min(target_size[WIDTH], Math.max(0, cursor[X])),
    Math.min(target_size[HEIGHT], Math.max(0, cursor[Y])),
  ]);

  let target_line = $derived.by(() => {
    let tl: Point = $state.snapshot(mouse) as Point;

    if (cursor[X] < 0) {
      tl[X] -= cursor[X];
    } else if (cursor[X] > target_size[X]) {
      tl[X] -= cursor[X] - target_size[X];
    }
    if (cursor[Y] < 0) {
      tl[Y] -= cursor[Y];
    } else if (cursor[Y] > target_size[Y]) {
      tl[Y] -= cursor[Y] - target_size[Y];
    }

    return tl;
  });

  let cursor_downscaled = $derived([target[X] / target_size[X], target[Y] / target_size[Y]]) as Point;

  // let svg: SVGElement
  let zoom: Zoomable;

  export function currentShape(
    shape: VideoShape,
    current_frame: number,
    interpolate: boolean = true,
  ): Point[] | undefined {
    if (shape.start > current_frame || shape.end < current_frame) return; // out of scope

    const current_points = shape.frames.find((v) => v.frame == current_frame)?.points;
    if (current_points || !interpolate) return current_points; // exists!

    const frame_start = shape.frames.reduce(
      (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
        (!acc || acc.frame < v.frame) && v.frame < frame ? v : acc,
      null,
    );

    const frame_end = shape.frames.reduce(
      (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
        (!acc || acc.frame > v.frame) && v.frame > frame ? v : acc,
      null,
    );

    if (frame_start && frame_end) {
      // interpolate from within bounds
      const ratio = (current_frame - frame_start.frame) / (frame_end.frame - frame_start.frame);
      return frame_end.points.map((point, i) => [
        // assume
        frame_start.points[i][X] + (point[X] - frame_start.points[i][X]) * ratio,
        frame_start.points[i][Y] + (point[Y] - frame_start.points[i][Y]) * ratio,
      ]);
    }
  }

  let tool_selection: ToolSelection | undefined = $state();

  export function selectionStart(e: MouseEvent) {
    if (!shape) {
      zoom.mouseDown(e);
      return console.warn(selectionStart, { shape: $state.snapshot(shape) });
    }

    tool_selection?.startSelection(cursor_downscaled);

    if (!tool_selection?.isEditing()) {
      onSelectAnnotation();
      zoom.mouseDown(e);
    }
  }

  export function selectionEnd(e: MouseEvent) {
    tool_selection?.endSelection(cursor_downscaled);

    zoom.mouseUp(e);
  }
</script>

<div class="svg-overlay flex-1">
  <div>
    <Zoomable bind:this={zoom} {mode} onZoomChange={(scale, offset) => (zoomInfo = { scale, offset })}>
      {@render children?.()}
    </Zoomable>
  </div>
  <svg
    bind:clientHeight={height}
    bind:clientWidth={width}
    class="h-full w-full"
    onmousemove={(e) => {
      // const elementRect = svg.getBoundingClientRect();

      // mouse = [e.layerX, e.layerY] //..
      mouse = [e.offsetX, e.offsetY]; //..
      // mouse[0] = e.pageX - (Math.round(elementRect.left) + window.scrollX);
      // mouse[1] = e.pageY - (Math.round(elementRect.top) + window.scrollY);
      // console.log({mouse:{x: mouse[X], y:mouse[Y]}, e})
      zoom.mouseMove(e);
    }}
    onmouseup={selectionEnd}
    onmousedown={(e) => selectionStart(e)}
    onwheel={(e) => {
      zoom.onWheel(e);
    }}
    {...restProps}
  >
    {#if width && height}
      <!-- prevent display issue on load for now -->
      <line x1={0} y1={target_line[Y]} x2={width} y2={target_line[Y]} stroke=#2b7fff />
      <line x1={target_line[X]} y1={0} x2={target_line[X]} y2={height} stroke=#2b7fff />
    {/if}

    <!-- draw annotation context -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation}
      {#key annotation}
        {#if annotation.metadata.id != selected?.metadata.id}
          {#if annotation.shape.type == "video:bounding_box"}
            <BoundingBox
              points={currentShape(annotation.shape, frame) || []}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={annotation.value.attributes?.data.color || "grey"}
              onmousedown={(e) => {
                if (mode == "visual" || selected) {
                  e.stopPropagation();
                  onSelectAnnotation(annotation);
                }
              }}
            />, frame
          {/if}
        {/if}
        {/key}
      {/each}
    {:then annotations}
      {#each annotations as annotation}
        {#key annotation}
          {#if annotation.metadata.id != selected?.metadata.id}
            {#if annotation.shape.type == "video:bounding_box"}
              <BoundingBox
                points={currentShape(annotation.shape, frame) || []}
                ratio={target_size}
                offset={zoomInfo.offset}
                color={annotation.value.attributes?.data.color || "grey"}
                onmousedown={(e) => {
                  if (mode == "visual" || selected) {
                    e.stopPropagation();
                    onSelectAnnotation(annotation);
                  }
                }}
              />
            {/if}
          {/if}
        {/key}
      {/each}
    {/await}

    <BoundingBox
      bind:this={tool_selection}
      {points}
      ratio={target_size}
      offset={zoomInfo.offset}
      cursor={cursor_downscaled}
      editable={mode == "video:bounding_box"}
      color={selected?.value.attributes?.data.color || "gray"}
      onChange={(bb) => {
        onSelection("video:bounding_box", frame, bb, selected?.metadata.id);
        points = bb;
      }}
    />
  </svg>
</div>

<style>
  .svg-overlay {
    position: relative;
  }
  .svg-overlay > div {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .svg-overlay > svg {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
