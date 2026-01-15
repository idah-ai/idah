<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";

  import BoundingBox, { type ToolSelection } from "./bounding-box.svelte";
  import Polygon from "./polygon.svelte";
  import { boundingBoxes } from "./idb_store.svelte";

  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_POLYGON, type EntryRoot } from "../type";
  import { HEIGHT, ORIGIN, WIDTH, X, Y, type Point, type VideoFrameSelection } from "./VideoAnnotationContext";
  import Zoomable from "./zoomable.svelte";

  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";
  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";
  import { cn } from "@/utils";
  import { interpolatePolygonAtFrame } from "./polygonInterpolation";

  // Types
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
  }

  // Props
  type Props = {
    frame: number;
    selected: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata> | undefined;
    mode: string;
    target_container: () => HTMLDivElement; // ..
    annotations_promise: Promise<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (type: string, frame: number, points?: Point[], id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
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
    onAddNewNote,
    onChangeFrame,
    children,
    videoResizedAt,
    ...restProps
  }: Props = $props();

  // Contexts
  let context = getContext<IActivityContext>("context");

  // Variables
  interface ZoomInfo {
    scale: number;
    offset: Point;
  }
  let zoomInfo: ZoomInfo = $state({
    scale: 1,
    offset: [0, 0],
  });

  let height = $state(0);
  let width = $state(0);
  let mouse: Point = $state([0, 0]);
  let shape: AnnotationShape | { type: EntryRoot } | undefined = $derived(
    selected
      ? selected.shape
      : mode != DEFAULT_MODE
        ? mode == ENTRY_ROOT
          ? { type: ENTRY_ROOT }
          : {
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
  let isNoteMode: boolean = $derived(mode === IDAH_NOTE);

  function updatedSize(): Point {
    videoResizedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions
    let target_dom_rect = target_container()?.getBoundingClientRect();
    zoomInfo; // eslint-disable-line @typescript-eslint/no-unused-expressions

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

  let cursor_downscaled: Point = $derived([target[X] / target_size[X], target[Y] / target_size[Y]]);

  // let svg: SVGElement
  let zoomableElement: Zoomable;

  export function zoomIn() {
    zoomableElement.zoomIn();
  }
  export function zoomOut() {
    zoomableElement.zoomOut();
  }

  export function currentShape(
    shape: AnnotationShape,
    current_frame: number,
    interpolate: boolean = true,
  ): Point[] | undefined {
    if (!shape.frames || shape.frames.length === 0) return; // no render (eg. entry:root)

    if (shape.start > current_frame || shape.end < current_frame) return; // out of scope

    const current_points = shape.frames.find((v: VideoFrameSelection) => v.frame == current_frame)?.points;
    if (current_points || !interpolate) return current_points; // exists!

    // find surrounding frames
    const frame_start: VideoFrameSelection = shape.frames.reduce(
      (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
        (!acc || acc.frame < v.frame) && v.frame < current_frame ? v : acc,
      null,
    );

    const frame_end: VideoFrameSelection = shape.frames.reduce(
      (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
        (!acc || acc.frame > v.frame) && v.frame > current_frame ? v : acc,
      null,
    );

    if (!frame_start || !frame_end) return;

    if (shape.type == IDAH_VIDEO_BOUNDING_BOX) {
      // interpolate from within bounds
      const ratio = (current_frame - frame_start.frame) / (frame_end.frame - frame_start.frame);

      return frame_end.points.map((point, i) => [
        // assume
        frame_start.points[i][X] + (point[X] - frame_start.points[i][X]) * ratio,
        frame_start.points[i][Y] + (point[Y] - frame_start.points[i][Y]) * ratio,
      ]);
    } else if (shape.type == IDAH_POLYGON) {
      // interpolate from within bounds
      return interpolatePolygonAtFrame(frame_start, frame_end, current_frame);
    }
  }

  let toolSelection: ToolSelection | undefined = $state();
  export function selectionStart(e: MouseEvent) {
    if (!shape) {
      zoomableElement.mouseDown(e);
      return;
    }

    toolSelection?.startSelection(cursor_downscaled);

    if (!toolSelection?.isEditing()) {
      if (!toolSelection)
        console.error("no tool for mode:", mode, "deselecting annotation (and reverting to mode", DEFAULT_MODE, ")");
      onSelectAnnotation();
      zoomableElement.mouseDown(e);
    }
  }

  export function selectionEnd(e: MouseEvent) {
    toolSelection?.endSelection(cursor_downscaled);

    showNewNoteFeedPopup();

    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) {
    /**
     * Show new note feed dialog only when there is no dragging (i.e. zoom offset did not change)
     */
    if (mode === IDAH_NOTE) {
      onAddNewNote({
        anchorType: annotation ? "annotation" : "entry",
        position: {
          x: cursor_downscaled[X],
          y: cursor_downscaled[Y],
          start: frame,
          end: frame,
          target_size,
          zoom_info: zoomInfo,
        },
        annotationId: annotation?.metadata.id || null,
      });
    }
  }

  onMount(() => {
    context.notes.onRequireNoteFeedPosition(async (noteFeed: INoteFeed) => {
      // 1. Check the frame
      const noteFeedStartFrame = (noteFeed.position.start as number) || 0;

      // 2. Go to the frame
      if (noteFeedStartFrame != frame) {
        onChangeFrame?.(noteFeedStartFrame);
      }

      /**
       * 3. Make the viewport at the same position from reviewer fow now
       * and will centered on the note feed later
       */
      const noteFeedZoomScale = (noteFeed.position.zoom_info as ZoomInfo)?.scale || 1;
      const noteFeedOffset = (noteFeed.position.zoom_info as ZoomInfo)?.offset || [height / 2, -(width / 2)];
      zoomableElement.setZoom(noteFeedZoomScale);
      zoomableElement.setOffset(noteFeedOffset);

      // 4. Return the absolute position for the top left corner of the note feed.
    });
  });

  const cursorConstraints = new Map([[IDAH_VIDEO_BOUNDING_BOX, 4]]);

  let pointer = $derived.by(() => {
    return mode != DEFAULT_MODE
      ? mode == IDAH_NOTE
        ? "cursor-note"
        : points.length < (cursorConstraints.get(mode) || 0) || toolSelection?.isEditing()
          ? "cursor-crosshair"
          : "cursor-grab"
      : "cursor-grab";
  });
</script>

<div class={cn("svg-overlay flex-1", pointer)}>
  <div>
    <Zoomable bind:this={zoomableElement} {mode} onZoomChange={(scale, offset) => (zoomInfo = { scale, offset })}>
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
      zoomableElement.mouseMove(e);
    }}
    onmouseup={(e) => selectionEnd(e)}
    onmousedown={(e) => selectionStart(e)}
    onwheel={(e) => zoomableElement.onWheel(e)}
    {...restProps}
  >
    {#if width && height && !isNoteMode && (pointer == "crosshair" || toolSelection?.isEditing())}
      <!-- prevent display issue on load for now -->
      <line x1={0} y1={target_line[Y]} x2={width} y2={target_line[Y]} stroke="#2b7fff" />
      <line x1={target_line[X]} y1={0} x2={target_line[X]} y2={height} stroke="#2b7fff" />
    {/if}

    <!-- draw annotation context -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != selected?.metadata.id}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            <BoundingBox
              {mode}
              {pointer}
              points={currentShape(annotation.shape, frame) || []}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IDAH_VIDEO_BOUNDING_BOX)?.[1]
                .values.find((c) => c.id == annotation.value?.category)?.color || "grey"}
              onmousedown={(e) => {
                e.stopPropagation();

                if (mode == DEFAULT_MODE || selected) {
                  onSelectAnnotation(annotation);
                }

                if (mode === IDAH_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {:else if annotation.shape.type == IDAH_POLYGON && !annotation.hidden}
            <Polygon
              {mode}
              {pointer}
              points={currentShape(annotation.shape, frame) || []}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IDAH_POLYGON)?.[1]
                .values.find((c) => c.id == annotation.value?.category)?.color || "grey"}
              onmousedown={(e) => {
                e.stopPropagation();

                if (mode == DEFAULT_MODE || selected) {
                  onSelectAnnotation(annotation);
                }

                if (mode === IDAH_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {/if}
        {/if}
      {/each}
    {:then annotations}
      {#each annotations as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != selected?.metadata.id}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            <BoundingBox
              {mode}
              {pointer}
              points={currentShape(annotation.shape, frame) || []}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={annotation?.synced
                ? Object.entries(context.config)
                    .find(([k, _]) => k == IDAH_VIDEO_BOUNDING_BOX)?.[1]
                    .values.find((c) => c.id == annotation?.value?.category)?.color || "grey"
                : "grey"}
              onmousedown={(e) => {
                e.stopPropagation();

                if (mode == DEFAULT_MODE || selected) {
                  onSelectAnnotation(annotation);
                }

                if (mode === IDAH_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {:else if annotation.shape.type == IDAH_POLYGON && !annotation.hidden}
            <Polygon
              {mode}
              {pointer}
              points={currentShape(annotation.shape, frame) || []}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={annotation?.synced
                ? Object.entries(context.config)
                    .find(([k, _]) => k == IDAH_POLYGON)?.[1]
                    .values.find((c) => c.id == annotation?.value?.category)?.color || "grey"
                : "grey"}
              onmousedown={(e) => {
                e.stopPropagation();

                if (mode == DEFAULT_MODE || selected) {
                  onSelectAnnotation(annotation);
                }

                if (mode === IDAH_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {/if}
        {/if}
      {/each}
    {/await}

    {#if selected && !selected.hidden}
      {#if shape?.type == IDAH_VIDEO_BOUNDING_BOX || mode == IDAH_VIDEO_BOUNDING_BOX}
        <BoundingBox
          {pointer}
          bind:this={toolSelection}
          {mode}
          {points}
          ratio={target_size}
          offset={zoomInfo.offset}
          cursor={cursor_downscaled}
          editable={(shape?.type == IDAH_VIDEO_BOUNDING_BOX || mode == IDAH_VIDEO_BOUNDING_BOX) &&
            !selected?.locked &&
            ["annotate", "review"].includes(context.workflowStep)}
          color={selected?.synced
            ? Object.entries(context.config)
                .find(([k, _]) => k == mode)?.[1]
                .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
            : "grey"}
          onChange={(bb) => {
            onSelection(IDAH_VIDEO_BOUNDING_BOX, frame, bb, selected?.metadata.id);
            points = bb;
          }}
        />
      {/if}

      {#if shape?.type == IDAH_POLYGON || mode == IDAH_POLYGON}
        <Polygon
          {pointer}
          bind:this={toolSelection}
          {mode}
          {points}
          ratio={target_size}
          offset={zoomInfo.offset}
          cursor={cursor_downscaled}
          editable={(shape?.type == IDAH_POLYGON || mode == IDAH_POLYGON) &&
            !selected?.locked &&
            ["annotate", "review"].includes(context.workflowStep)}
          color={selected?.synced
            ? Object.entries(context.config)
                .find(([k, _]) => k == mode)?.[1]
                .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
            : "grey"}
          onChange={(polygon_points) => {
            onSelection(IDAH_POLYGON, frame, polygon_points, selected?.metadata.id);
            points = polygon_points;
          }}
        />
      {/if}
    {/if}
  </svg>
</div>

<style>
  .svg-overlay {
    position: relative;
  }

  .cursor-note {
    cursor: url("/app/frontend/src/plugins/assets/icons/message-circle.svg"), auto;
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
