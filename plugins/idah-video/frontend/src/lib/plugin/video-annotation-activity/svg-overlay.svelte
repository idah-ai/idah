<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import BoundingBox, {
    type ToolSelection,
  } from "$lib/plugin/video-annotation-activity/shape/bounding-box/bounding-box.svelte";
  import Polygon from "$lib/plugin/video-annotation-activity/shape/polygon/polygon.svelte";
  import Zoomable from "$lib/plugin/video-annotation-activity/zoomable.svelte";

  import {
    DEFAULT_MODE,
    ENTRY_ROOT,
    IDAH_NOTE,
    IDAH_VIDEO_BOUNDING_BOX,
    IDAH_VIDEO_POLYGON,
    type EntryRoot,
  } from "$lib/plugin/type";
  import {
    getInterpolatedFrame,
    HEIGHT,
    ORIGIN,
    WIDTH,
    X,
    Y,
    type InterpolatedVertex,
    type Point,
    type VideoAnnotationObject,
    type VideoShape,
  } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  import { boundingBoxes } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import {
    currentMode,
    deselectAnnotationGroup,
    selectedAnnotation,
  } from "$lib/plugin/video-annotation-activity/store/store";

  import type {
    IActivityContext,
    IConfigPropertyStyles,
    INoteFeed,
  } from "$idah/context/activity-context";
  import type { AnnotationShape } from "$idah/context/annotation-context";

  // Types
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
  }

  // Props
  type Props = {
    frame: number;
    target_container: () => HTMLDivElement | undefined; // ..
    annotations_promise: Promise<VideoAnnotationObject[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: VideoAnnotationObject) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (
      type: string,
      frame: number,
      points?: Point[],
      angle?: number,
      id?: string,
    ) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
    videoResizedAt: Date;
    isPlaying: boolean;
  };
  let {
    frame,
    target_container,
    annotations_promise,
    onSelectAnnotation,
    onSelection, // valid shape output
    onAddNewNote,
    onChangeFrame,
    children,
    videoResizedAt,
    isPlaying,
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
    $selectedAnnotation
      ? $selectedAnnotation.shape
      : $currentMode != DEFAULT_MODE
        ? $currentMode == ENTRY_ROOT
          ? { type: ENTRY_ROOT }
          : {
              type: $currentMode,
              start: frame,
              end: frame,
              frames: [],
            }
        : undefined,
  );

  let current_shape = $derived.by(() => {
    if (shape) return getInterpolatedFrame(shape as VideoShape, frame);
  });

  let points: Point[] | InterpolatedVertex[] | undefined = $derived(
    current_shape && "points" in current_shape
      ? current_shape?.points || []
      : [],
  );

  let angle: number = $derived.by(() => {
    return current_shape?.angle || 0;
  });

  function updatedSize(): Point {
    videoResizedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions
    let target_dom_rect = target_container()?.getBoundingClientRect();
    zoomInfo; // eslint-disable-line @typescript-eslint/no-unused-expressions

    return !target_dom_rect
      ? ORIGIN
      : [target_dom_rect.width, target_dom_rect.height];
  }

  let target_size: Point = $derived.by(updatedSize);

  let cursor = $derived([
    mouse[X] - zoomInfo.offset[X],
    mouse[Y] - zoomInfo.offset[Y],
  ]);

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

  let cursor_downscaled: Point = $derived([
    target[X] / target_size[X],
    target[Y] / target_size[Y],
  ]);

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
      deselectAnnotationGroup();
      zoomableElement.mouseDown(e);
      return;
    }

    toolSelection?.startSelection(cursor_downscaled);

    if (!isEditing) {
      if (!toolSelection) {
        console.error(
          "no tool for mode:",
          $currentMode,
          "deselecting annotation (and reverting to mode",
          DEFAULT_MODE,
        );
      }

      onSelectAnnotation();
      zoomableElement.mouseDown(e);
      deselectAnnotationGroup();
    }
  }

  export function selectionEnd(e: MouseEvent) {
    toolSelection?.endSelection(cursor_downscaled);

    showNewNoteFeedPopup();

    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: VideoAnnotationObject) {
    /**
     * Show new note feed dialog only when there is no dragging (i.e. zoom offset did not change)
     */
    if ($currentMode === IDAH_NOTE) {
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
      const noteFeedZoomScale =
        (noteFeed.position.zoom_info as ZoomInfo)?.scale || 1;
      const noteFeedOffset = (noteFeed.position.zoom_info as ZoomInfo)
        ?.offset || [height / 2, -(width / 2)];
      zoomableElement.setZoom(noteFeedZoomScale);
      zoomableElement.setOffset(noteFeedOffset);

      // 4. Return the absolute position for the top left corner of the note feed.
    });
  });

  let isEditing = $state(false);
  let editionCursor: string | undefined = $state(undefined);

  // Reset editionCursor when switching to visual mode without selection
  $effect(() => {
    if ($currentMode === DEFAULT_MODE && !$selectedAnnotation) {
      editionCursor = undefined;
    }
  });

  let pointer = $derived.by(() => {
    if ($currentMode == IDAH_NOTE) return "cursor-note";
    if (editionCursor) return editionCursor;
    if ($selectedAnnotation) return "cursor-pointer";
    return "cursor-grab";
  });

  let showCrosshair = $derived(
    width > 0 &&
      height > 0 &&
      !isPlaying &&
      ![IDAH_NOTE, DEFAULT_MODE].includes($currentMode) &&
      (pointer === "crosshair" || pointer === "cursor-crosshair" || isEditing),
  );

  function getAnnotationPropertyStyle(
    annotation?: VideoAnnotationObject,
  ): IConfigPropertyStyles {
    const defaultStyle: IConfigPropertyStyles = {
      border: "solid",
      opacity: 100,
    };
    if (!annotation) return defaultStyle;

    const assignedAttributes = annotation.value.attributes || {};

    // Determine which config to use based on annotation shape type
    const configKey = annotation.shape.type;

    const assignedAttributeProperties =
      Object.entries(context.config)
        .find(([k, _]) => k == configKey)?.[1]
        .properties.filter((property) => property.id in assignedAttributes) ||
      [];

    const assignedAttributesStyles = Object.entries(assignedAttributes)
      .map(([propertyKey, properyValue]) => {
        const property = assignedAttributeProperties.find(
          (p) => p.id === propertyKey,
        );
        if (property) {
          return {
            ...property.format.options?.find(
              (option) => option.id === properyValue,
            )?.styles,
          };
        } else {
          return {};
        }
      })
      .filter((style) => style != undefined && Object.keys(style).length > 0);

    const lastAssignedAttributeStyle =
      assignedAttributesStyles[assignedAttributesStyles.length - 1];

    return lastAssignedAttributeStyle;
  }
</script>

<div class={cn("svg-overlay flex-1", pointer)}>
  <div>
    <Zoomable
      bind:this={zoomableElement}
      onZoomChange={(scale, offset) => (zoomInfo = { scale, offset })}
    >
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
    {#if showCrosshair}
      <!-- prevent display issue on load for now -->
      <line
        x1={0}
        y1={target_line[Y]}
        x2={width}
        y2={target_line[Y]}
        stroke={$selectedAnnotation?.synced
          ? Object.entries(context.config)
              .find(([k, _]) => k == $currentMode)?.[1]
              .values.find((c) => c.id == $selectedAnnotation?.value?.category)
              ?.color || "grey"
          : "grey"}
      />
      <line
        x1={target_line[X]}
        y1={0}
        x2={target_line[X]}
        y2={height}
        stroke={$selectedAnnotation?.synced
          ? Object.entries(context.config)
              .find(([k, _]) => k == $currentMode)?.[1]
              .values.find((c) => c.id == $selectedAnnotation?.value?.category)
              ?.color || "grey"
          : "grey"}
      />
    {/if}

    <!-- draw annotation context -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != $selectedAnnotation?.metadata.id}
          {@const propertyStyle = getAnnotationPropertyStyle(annotation)}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            {@const current_annotation_shape = getInterpolatedFrame(
              annotation.shape as VideoShape,
              frame,
            )}
            {@const current_annotation_points =
              current_annotation_shape?.points || []}
            {@const current_annotation_angle =
              current_annotation_shape?.angle || 0}
            <BoundingBox
              mode={$currentMode}
              points={current_annotation_points as Point[]}
              angle={current_annotation_angle}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IDAH_VIDEO_BOUNDING_BOX)?.[1]
                .values.find((c) => c.id == annotation.value?.category)
                ?.color || "grey"}
              styles={propertyStyle}
              onmousedown={(e) => {
                e.stopPropagation();

                if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                  onSelectAnnotation(annotation);
                }

                if ($currentMode === IDAH_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {:else if annotation.shape.type == IDAH_VIDEO_POLYGON && !annotation.hidden}
            <Polygon
              mode={$currentMode}
              points={(getInterpolatedFrame(
                annotation.shape as VideoShape,
                frame,
              )?.points || []) as InterpolatedVertex[]}
              ratio={target_size}
              offset={zoomInfo.offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IDAH_VIDEO_POLYGON)?.[1]
                .values.find((c) => c.id == annotation.value?.category)
                ?.color || "grey"}
              styles={propertyStyle}
              onmousedown={(e) => {
                e.stopPropagation();

                if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                  onSelectAnnotation(annotation);
                }

                if ($currentMode === IDAH_NOTE) {
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
          {#if annotation.metadata.id != $selectedAnnotation?.metadata.id}
            {@const propertyStyle = getAnnotationPropertyStyle(annotation)}
            {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
              {@const current_annotation_shape = getInterpolatedFrame(
                annotation.shape as VideoShape,
                frame,
              )}
              {@const current_annotation_points =
                current_annotation_shape?.points || []}
              {@const current_annotation_angle =
                current_annotation_shape?.angle || 0}

              <BoundingBox
                mode={$currentMode}
                points={current_annotation_points as Point[]}
                angle={current_annotation_angle}
                ratio={target_size}
                offset={zoomInfo.offset}
                color={annotation?.synced
                  ? Object.entries(context.config)
                      .find(([k, _]) => k == IDAH_VIDEO_BOUNDING_BOX)?.[1]
                      .values.find((c) => c.id == annotation?.value?.category)
                      ?.color || "grey"
                  : "grey"}
                styles={propertyStyle}
                onmousedown={(e) => {
                  e.stopPropagation();

                  if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                    onSelectAnnotation(annotation);
                  }

                  if ($currentMode === IDAH_NOTE) {
                    showNewNoteFeedPopup(annotation);
                  }
                }}
              />
            {:else if annotation.shape.type == IDAH_VIDEO_POLYGON && !annotation.hidden}
              <Polygon
                mode={$currentMode}
                points={(getInterpolatedFrame(
                  annotation.shape as VideoShape,
                  frame,
                )?.points || []) as InterpolatedVertex[]}
                ratio={target_size}
                offset={zoomInfo.offset}
                color={annotation?.synced
                  ? Object.entries(context.config)
                      .find(([k, _]) => k == IDAH_VIDEO_POLYGON)?.[1]
                      .values.find((c) => c.id == annotation?.value?.category)
                      ?.color || "grey"
                  : "grey"}
                styles={propertyStyle}
                onmousedown={(e) => {
                  e.stopPropagation();

                  if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                    onSelectAnnotation(annotation);
                  }

                  if ($currentMode === IDAH_NOTE) {
                    showNewNoteFeedPopup(annotation);
                  }
                }}
              />
            {/if}
          {/if}
        {/each}
      {/key}
    {/await}

    <!-- STATE:: SELECTED -->
    {#if $selectedAnnotation || $currentMode != DEFAULT_MODE}
      {@const propertyStyle = getAnnotationPropertyStyle($selectedAnnotation)}
      {#if shape?.type == IDAH_VIDEO_BOUNDING_BOX || $currentMode == IDAH_VIDEO_BOUNDING_BOX}
        {#key [shape, frame]}
          <BoundingBox
            bind:this={toolSelection}
            mode={$currentMode}
            points={points as Point[]}
            {angle}
            onEditingChange={(editing) => {
              isEditing = editing;
            }}
            onPointerChange={(c) => (editionCursor = c)}
            ratio={target_size}
            offset={zoomInfo.offset}
            cursor={cursor_downscaled}
            hidden={$selectedAnnotation?.hidden}
            editable={(shape?.type == IDAH_VIDEO_BOUNDING_BOX ||
              $currentMode == IDAH_VIDEO_BOUNDING_BOX) &&
              !$selectedAnnotation?.locked &&
              ["annotate", "review"].includes(context.workflowStep)}
            color={$selectedAnnotation?.synced
              ? Object.entries(context.config)
                  .find(([k, _]) => k == $currentMode)?.[1]
                  .values.find(
                    (c) => c.id == $selectedAnnotation?.value?.category,
                  )?.color || "grey"
              : "grey"}
            styles={propertyStyle}
            onChange={(bb, newAngle) => {
              onSelection(
                IDAH_VIDEO_BOUNDING_BOX,
                frame,
                bb,
                newAngle,
                $selectedAnnotation?.metadata.id,
              );
              // points = bb;
            }}
          />
        {/key}
      {/if}

      {#if shape?.type == IDAH_VIDEO_POLYGON || $currentMode == IDAH_VIDEO_POLYGON}
        <Polygon
          bind:this={toolSelection}
          mode={$currentMode}
          points={points as Point[] | InterpolatedVertex[]}
          onEditingChange={(editing) => {
            isEditing = editing;
          }}
          onPointerChange={(c) => (editionCursor = c)}
          ratio={target_size}
          offset={zoomInfo.offset}
          cursor={cursor_downscaled}
          hidden={$selectedAnnotation?.hidden}
          editable={(shape?.type == IDAH_VIDEO_POLYGON ||
            $currentMode == IDAH_VIDEO_POLYGON) &&
            !$selectedAnnotation?.locked &&
            ["annotate", "review"].includes(context.workflowStep)}
          color={$selectedAnnotation?.synced
            ? Object.entries(context.config)
                .find(([k, _]) => k == $currentMode)?.[1]
                .values.find(
                  (c) => c.id == $selectedAnnotation?.value?.category,
                )?.color || "grey"
            : "grey"}
          styles={propertyStyle}
          onChange={(polygon_points) => {
            onSelection(
              IDAH_VIDEO_POLYGON,
              frame,
              polygon_points,
              0,
              $selectedAnnotation?.metadata.id,
            );
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
    cursor: url("/app/frontend/src/plugins/assets/icons/message-circle.svg"),
      auto;
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
