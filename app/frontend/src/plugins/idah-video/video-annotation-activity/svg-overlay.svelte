<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";

  import BoundingBox, { type ToolSelection } from "./bounding-box.svelte";
  import Polygon from "./polygon.svelte";
  import { boundingBoxes } from "./idb_store.svelte";

  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_POLYGON, type EntryRoot } from "../type";
  import {
    HEIGHT,
    ORIGIN,
    WIDTH,
    X,
    Y,
    type InterpolatedVertex,
    type Point,
    type VideoShape,
    getInterpolatedFrame,
  } from "./VideoAnnotationContext";
  import Zoomable from "./zoomable.svelte";

  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";
  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";
  import { cn } from "@/utils";

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
    target_container: () => HTMLDivElement | undefined; // ..
    annotations_promise: Promise<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
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

  let current_shape = $derived.by(() => {
    if (shape) return getInterpolatedFrame(shape as VideoShape, frame);
  });
  let points: Point[] | InterpolatedVertex[] | undefined = $derived.by(() => {
    if (current_shape && "points" in current_shape) {

      return current_shape.points || [];
    }   else  {
      return  [];
    }

  });
  let angle: number = $derived.by(() => {
    return current_shape?.angle || 0;
  });

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

  let toolSelection: ToolSelection | undefined = $state();
  export function selectionStart(e: MouseEvent) {
    if (!shape) {
      zoomableElement.mouseDown(e);
      return;
    }

    toolSelection?.startSelection(cursor_downscaled);

    if (!isEditing) {
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

  let isEditing = $state(false);
  let editionCursor: string | undefined = $state(undefined);

  // Reset editionCursor when switching to visual mode without selection
  $effect(() => {
    if (mode === DEFAULT_MODE && !selected) {
      editionCursor = undefined;
    }
  });

  let pointer = $derived.by(() => {
    if (mode == IDAH_NOTE) return "cursor-note";
    if (editionCursor) return editionCursor;
    if (selected) return "cursor-pointer";

    return "cursor-grab";
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
    {#if width && height && ![IDAH_NOTE, DEFAULT_MODE].includes(mode) && (pointer == "crosshair" || isEditing)}
      <!-- prevent display issue on load for now -->
      <line
        x1={0}
        y1={target_line[Y]}
        x2={width}
        y2={target_line[Y]}
        stroke={selected?.synced
          ? Object.entries(context.config)
              .find(([k, _]) => k == mode)?.[1]
              .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
          : "grey"}
      />
      <line
        x1={target_line[X]}
        y1={0}
        x2={target_line[X]}
        y2={height}
        stroke={selected?.synced
          ? Object.entries(context.config)
              .find(([k, _]) => k == mode)?.[1]
              .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
          : "grey"}
      />
    {/if}

    <!-- draw annotation context -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != selected?.metadata.id}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as VideoShape, frame)}
            {@const current_annotation_points = current_annotation_shape?.points || []}
            {@const current_annotation_angle = current_annotation_shape?.angle || 0}
            <BoundingBox
              {mode}
              points={current_annotation_points as Point[]}
              angle={current_annotation_angle}
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
              points={(getInterpolatedFrame(annotation.shape as VideoShape, frame)?.points || []) as InterpolatedVertex[]}
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
      {#key frame}
        {#each annotations as annotation (annotation.metadata.id)}
          {#if annotation.metadata.id != selected?.metadata.id}
            {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
              {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as VideoShape, frame)}
              {@const current_annotation_points = current_annotation_shape?.points || []}
              {@const current_annotation_angle = current_annotation_shape?.angle || 0}
              <BoundingBox
                {mode}
                points={current_annotation_points as Point[]}
                angle={current_annotation_angle}
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
                points={(getInterpolatedFrame(annotation.shape as VideoShape, frame)?.points || []) as InterpolatedVertex[]}
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
      {/key}
    {/await}

    {#if selected || mode != DEFAULT_MODE}
      {#if shape?.type == IDAH_VIDEO_BOUNDING_BOX || mode == IDAH_VIDEO_BOUNDING_BOX}
        {#key [shape, frame]}
          <BoundingBox
            bind:this={toolSelection}
            {mode}
            points = {points as Point[]}
            {angle}
            onEditingChange={(editing: any) => {
              isEditing = editing;
            }}
            onPointerChange={(c) => (editionCursor = c)}
            ratio={target_size}
            offset={zoomInfo.offset}
            cursor={cursor_downscaled}
            hidden={selected?.hidden}
            editable={(shape?.type == IDAH_VIDEO_BOUNDING_BOX || mode == IDAH_VIDEO_BOUNDING_BOX) &&
              !selected?.locked &&
              ["annotate", "review"].includes(context.workflowStep)}
            color={selected?.synced
              ? Object.entries(context.config)
                  .find(([k, _]) => k == mode)?.[1]
                  .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
              : "grey"}
            onChange={(bb, newAngle) => {
              onSelection(IDAH_VIDEO_BOUNDING_BOX, frame, bb, newAngle, selected?.metadata.id);
              // points = bb;
            }}
          />
        {/key}
      {/if}

      {#if shape?.type == IDAH_POLYGON || mode == IDAH_POLYGON}
        <Polygon
          bind:this={toolSelection}
          {mode}
          points={points as Point[] | InterpolatedVertex[]}
          onEditingChange={(editing: any) => {
              isEditing = editing;
            }}
          onPointerChange={(c) => (editionCursor = c)}
          ratio={target_size}
          offset={zoomInfo.offset}
          cursor={cursor_downscaled}
          hidden={selected?.hidden}
          editable={(shape?.type == IDAH_POLYGON || mode == IDAH_POLYGON) &&
            !selected?.locked &&
            ["annotate", "review"].includes(context.workflowStep)}
          color={selected?.synced
            ? Object.entries(context.config)
                .find(([k, _]) => k == mode)?.[1]
                .values.find((c) => c.id == selected?.value?.category)?.color || "grey"
            : "grey"}
          onChange={(polygon_points) => {
            onSelection(IDAH_POLYGON, frame, polygon_points, 0, selected?.metadata.id);
            // points = polygon_points;
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
