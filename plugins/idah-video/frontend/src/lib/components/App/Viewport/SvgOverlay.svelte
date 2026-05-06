<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import BoundingBox, {
    type ToolSelection,
  } from "$lib/components/App/Viewport/Shapes/BoundingBox/BoundingBox.svelte";
  import Polygon from "$lib/components/App/Viewport/Shapes/Polygon/Polygon.svelte";
  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";

  import {
    DEFAULT_MODE,
    EDITOR_MODE_TOOLS,
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
  import { viewport } from "$lib/plugin/video-annotation-activity/state/viewport.svelte";

  import type { IActivityContext, IConfigPropertyStyles, INoteFeed } from "$idah/context/activity-context";
  import type { AnnotationShape } from "$idah/context/annotation-context";

  // Types
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
  }

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
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
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

  // Sync workspace dimensions with viewport state
  $effect(() => {
    viewport.workspace.dimensions = [width, height];
  });

  // Sync workspace transform with viewport state
  $effect(() => {
    viewport.workspace.transform = {
      ...viewport.workspace.transform,
      scale: zoomInfo.scale,
      translate: zoomInfo.offset,
    };
  });

  let mouse: Point = $state([0, 0]);

  // TODO: find a better way to pass shape initialization

  let shape: AnnotationShape | undefined = $state();
  let current_shape: VideoShape | undefined = $state();

  let points: Point[] | undefined = $state();
  let angle: number | undefined = $state();

  // Reste shape when we are not editing
  $effect(() => {
    if (!$selectedAnnotation) {
      current_shape = undefined;
    }
  });

  function updatedSize() {
    if (!target_container()) return;
    let target_dom_rect = target_container()!.getBoundingClientRect();
    height = target_dom_rect.height;
    width = target_dom_rect.width;
  }

  let target_size: Point = $state([0, 0]);
  let cursor = $derived(mouse);
  let target: Point = $derived([cursor[X] * target_size[X], cursor[Y] * target_size[Y]]);

  let target_line: Point = $derived.by(() => {
    let tl: Point = [0, 0];

    tl[X] = (mouse[X] - zoomInfo.offset[X]) / zoomInfo.scale;
    tl[Y] = (mouse[Y] - zoomInfo.offset[Y]) / zoomInfo.scale;

    return tl;
  });

  let cursor_downscaled: Point = $derived([target[X] / target_size[X], target[Y] / target_size[Y]]);

  // let svg: SVGElement
  let zoomableElement: Viewport;

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

    if (!isEditing && EDITOR_MODE_TOOLS.includes($currentMode)) {
      if (!toolSelection) {
        console.error(
          "no tool for mode: ",
          $currentMode,
          " is found, deselecting annotation and reverting to mode: ",
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
      const noteFeedZoomScale = (noteFeed.position.zoom_info as ZoomInfo)?.scale || 1;
      const noteFeedOffset = (noteFeed.position.zoom_info as ZoomInfo)?.offset || [height / 2, -(width / 2)];
      zoomableElement.setZoom(noteFeedZoomScale);
      zoomableElement.setOffset(noteFeedOffset);

      // 4. Return the absolute position for the top left corner of the note feed.
    });

    async function setNoteModeCursor() {
      const cursorNoteSvgText = await context.icons.get("cursor-note");
      const encoded = encodeURIComponent(cursorNoteSvgText);
      const dataUrl = `data:image/svg+xml,${encoded}`;

      const style = document.createElement("style");
      style.textContent = `
        .cursor-note {
          cursor: url(${dataUrl}) 0 20, auto;
        }
      `;
      /** Note: 20 is the height need to shift the svg icon to the tip of mouse arrow cursor */

      document.head.appendChild(style);
    }

    setNoteModeCursor();
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
      ![IDAH_NOTE, DEFAULT_MODE].includes($currentMode) && // TODO:: Change to check set of editing mode @audi
      (pointer === "crosshair" || pointer === "cursor-crosshair" || isEditing),
  );

  function getAnnotationPropertyStyle(annotation?: VideoAnnotationObject): IConfigPropertyStyles {
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
        .properties.filter((property) => property.id in assignedAttributes) || [];

    const assignedAttributesStyles = Object.entries(assignedAttributes)
      .map(([propertyKey, properyValue]) => {
        const property = assignedAttributeProperties.find((p) => p.id === propertyKey);
        if (property) {
          return {
            ...property.format.options?.find((option) => option.id === properyValue)?.styles,
          };
        } else {
          return {};
        }
      })
      .filter((style) => style != undefined && Object.keys(style).length > 0);

    const lastAssignedAttributeStyle = assignedAttributesStyles[assignedAttributesStyles.length - 1];

    return lastAssignedAttributeStyle;
  }
</script>

<div class={cn("svg-overlay flex-1", pointer)}>
  <div>
    <Viewport bind:this={zoomableElement} onZoomChange={(scale, offset) => (zoomInfo = { scale, offset })}>
      {@render children?.()}
    </Viewport>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    width="100%"
    height="100%"
    onkeydown={() => {}}
    bind:clientHeight={height}
    bind:clientWidth={width}
    onmousedown={(e) => {
      selectionStart(e);
    }}
    onmouseup={(e) => {
      selectionEnd(e);
    }}
    onmousemove={(e) => {
      // const elementRect = svg.getBoundingClientRect();

      // mouse = [e.layerX, e.layerY] //..
      mouse = [e.offsetX, e.offsetY]; //..
      // mouse[0] = e.pageX - (Math.round(elementRect.left) + window.scrollX);
      // mouse[1] = e.pageY - (Math.round(elementRect.top) + window.scrollY);
      // console.log({mouse:{x: mouse[X], y:mouse[Y]}, e})
      zoomableElement.mouseMove(e);
    }}
    onwheel={(e) => {
      e.preventDefault();
      zoomableElement.onWheel(e);
    }}
  >
    {#if showCrosshair}
      <!-- Crosshair is an SVG group with infinite width lines -->
      <line
        x1={target_line[X] - 10000}
        y1={target_line[Y]}
        x2={target_line[X] + 10000}
        y2={target_line[Y]}
        stroke="rgba(100,100,100,0.25)"
        stroke-width="1"
      />
      <line
        x1={target_line[X]}
        y1={target_line[Y] - 10000}
        x2={target_line[X]}
        y2={target_line[Y] + 10000}
        stroke="rgba(100,100,100,0.25)"
        stroke-width="1"
      />
    {/if}

    <!-- eslint-disable-next-line -->
    <!-- Here we await the first window's annotations (the ones in IDB), then handle them -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != $selectedAnnotation?.metadata.id}
          {@const propertyStyle = getAnnotationPropertyStyle(annotation)}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as VideoShape, frame)}
            {@const current_annotation_points = current_annotation_shape?.points || []}
            {@const current_annotation_angle = current_annotation_shape?.angle || 0}
            <BoundingBox
              points={current_annotation_points}
              angle={current_annotation_angle}
              {frame}
              hidden={annotation.hidden}
              id={annotation.metadata.id}
              {propertyStyle}
            />
          {:else if annotation.shape.type == IDAH_VIDEO_POLYGON && !annotation.hidden}
            <Polygon
              points={annotation.shape.frames[frame]?.points || []}
              angle={annotation.shape.frames[frame]?.angle || 0}
              {frame}
              hidden={annotation.hidden}
              id={annotation.metadata.id}
              {propertyStyle}
            />
          {/if}
        {/if}
      {/each}
    {:then annotations}
      {#each annotations as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != $selectedAnnotation?.metadata.id}
          {@const propertyStyle = getAnnotationPropertyStyle(annotation)}
          {#if annotation.shape.type == IDAH_VIDEO_BOUNDING_BOX && !annotation.hidden}
            {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as VideoShape, frame)}
            {@const current_annotation_points = current_annotation_shape?.points || []}
            {@const current_annotation_angle = current_annotation_shape?.angle || 0}
            <BoundingBox
              points={current_annotation_points}
              angle={current_annotation_angle}
              {frame}
              hidden={annotation.hidden}
              id={annotation.metadata.id}
              {propertyStyle}
            />
          {:else if annotation.shape.type == IDAH_VIDEO_POLYGON && !annotation.hidden}
            <Polygon
              points={annotation.shape.frames[frame]?.points || []}
              angle={annotation.shape.frames[frame]?.angle || 0}
              {frame}
              hidden={annotation.hidden}
              id={annotation.metadata.id}
              {propertyStyle}
            />
          {/if}
        {/if}
      {/each}
    {/await}

    {#if $selectedAnnotation || $currentMode != DEFAULT_MODE}
      {@const propertyStyle = getAnnotationPropertyStyle($selectedAnnotation)}
      {#if shape?.type == IDAH_VIDEO_BOUNDING_BOX || $currentMode == IDAH_VIDEO_BOUNDING_BOX}
        <BoundingBox
          points={points || []}
          {angle}
          {frame}
          active={true}
          {shape}
          {propertyStyle}
          onEdit={(pointsUpdated: Point[], angleUpdated: number) => {
            points = pointsUpdated;
            angle = angleUpdated;
          }}
          onEditStop={({ points: editedPoints, angle: editedAngle }: { points: Point[]; angle: number }) => {
            onSelection($currentMode, frame, editedPoints, editedAngle, $selectedAnnotation?.metadata.id);
          }}
        />
      {/if}
      {#if shape?.type == IDAH_VIDEO_POLYGON || $currentMode == IDAH_VIDEO_POLYGON}
        <Polygon
          points={points || []}
          {angle}
          {frame}
          active={true}
          {shape}
          {propertyStyle}
          onEdit={(pointsUpdated: Point[], angleUpdated: number) => {
            points = pointsUpdated;
            angle = angleUpdated;
          }}
          onEditStop={({ points: editedPoints, angle: editedAngle }: { points: Point[]; angle: number }) => {
            onSelection($currentMode, frame, editedPoints, editedAngle, $selectedAnnotation?.metadata.id);
          }}
        />
      {/if}
    {/if}
  </svg>
</div>

<style>
  .svg-overlay {
    position: relative;
    overflow: hidden;
  }

  .svg-overlay > div {
    position: absolute;
    width: 100%;
    height: 100%;
  }

  .svg-overlay > svg {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
