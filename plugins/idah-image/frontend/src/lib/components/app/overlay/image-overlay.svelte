<script lang="ts">
  import { getContext } from "svelte";

  import { cn } from "$lib/utils";

  import {
    getInterpolatedFrame,
    HEIGHT,
    ORIGIN,
    WIDTH,
    X,
    Y,
    type ImageAnnotationObject,
    type ImageShape,
    type InterpolatedVertex,
    type Point,
  } from "$lib/context/image-annotation-context";
  import { boundingBoxes } from "$lib/plugin/store/idb-store.svelte";
  import { currentMode, deselectAnnotationGroup, selectedAnnotation } from "$lib/plugin/store/store";
  import {
    DEFAULT_MODE,
    ENTRY_ROOT,
    IMAGE_BOUNDING_BOX,
    IMAGE_NOTE,
    IMAGE_POLYGON,
    type EntryRoot,
  } from "$lib/plugin/types";

  import BoundingBox from "$lib/plugin/shape/bounding-box/bounding-box.svelte";
  import Polygon from "$lib/plugin/shape/polygon/polygon.svelte";

  import type { AnnotationShape } from "$lib/context/annotation-context";
  import type { IActivityContext, IConfigPropertyStyles } from "$lib/context/context";
  import type { ToolSelection } from "$lib/plugin/shape/bounding-box/bounding-box.svelte";

  // Types
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
  }

  // Props
  type Props = {
    frame: number;
    annotations_promise: Promise<ImageAnnotationObject[]>;
    onSelectAnnotation: (annotation?: ImageAnnotationObject) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    src: string;
    imageResizedAt: Date;
  };
  let {
    frame,
    annotations_promise,
    onSelectAnnotation,
    onSelection, // valid shape output
    onAddNewNote,
    src,
    imageResizedAt,
    ...restProps
  }: Props = $props();

  // Contexts
  let context = getContext<IActivityContext>("context");

  // Variables
  let offset: Point = $state([0, 0]);
  let target_container: HTMLImageElement | undefined = $state();

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
    if (shape) return getInterpolatedFrame(shape as ImageShape, frame);
  });

  let points: Point[] | InterpolatedVertex[] | undefined = $derived(
    current_shape && "points" in current_shape ? current_shape?.points || [] : [],
  );

  let angle: number = $derived.by(() => {
    return current_shape?.angle || 0;
  });

  let image: HTMLImageElement;

  // Functions
  function updatedSize(): Point {
    imageResizedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions
    if (!target_container) {
      console.error({ setUpPlayer: { target_container } });
      return ORIGIN;
    }

    let target_dom_rect = target_container.getBoundingClientRect();

    return !target_dom_rect ? ORIGIN : [target_dom_rect.width, target_dom_rect.height];
  }

  let target_size: Point = $derived.by(updatedSize);

  let cursor = $derived([mouse[X] - offset[X], mouse[Y] - offset[Y]]);

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
    console.log({ shape, tl, cursor, target_size });

    return tl;
  });

  let cursor_downscaled: Point = $derived([target[X] / target_size[X], target[Y] / target_size[Y]]);

  let toolSelection: ToolSelection | undefined = $state();

  export function selectionStart() {
    if (!shape) {
      deselectAnnotationGroup();
      return;
    }

    toolSelection?.startSelection(cursor_downscaled);

    if (!isEditing) {
      if (!toolSelection) {
        console.error("no tool for mode:", $currentMode, "deselecting annotation (and reverting to mode", DEFAULT_MODE);
      }

      onSelectAnnotation();
      deselectAnnotationGroup();
    }
  }

  export function selectionEnd() {
    toolSelection?.endSelection(cursor_downscaled);

    showNewNoteFeedPopup();
  }

  function showNewNoteFeedPopup(annotation?: ImageAnnotationObject) {
    /**
     * Show new note feed dialog only when there is no dragging (i.e. zoom offset did not change)
     */
    if ($currentMode === IMAGE_NOTE) {
      onAddNewNote({
        anchorType: annotation ? "annotation" : "entry",
        position: {
          x: cursor_downscaled[X],
          y: cursor_downscaled[Y],
          start: frame,
          end: frame,
          target_size,
          // zoom_info: zoomInfo,
        },
        annotationId: annotation?.metadata.id || null,
      });
    }
  }

  let isEditing = $state(false);
  let editionCursor: string | undefined = $state(undefined);

  // Reset editionCursor when switching to visual mode without selection
  $effect(() => {
    if ($currentMode === DEFAULT_MODE && !$selectedAnnotation) {
      editionCursor = undefined;
    }
  });

  let pointer = $derived.by(() => {
    if ($currentMode == IMAGE_NOTE) return "cursor-note";
    if (editionCursor) return editionCursor;
    if ($selectedAnnotation) return "cursor-pointer";
    return "cursor-grab";
  });

  let showCrosshair = $derived(
    width > 0 &&
      height > 0 &&
      ![IMAGE_NOTE, DEFAULT_MODE].includes($currentMode) && // TODO:: Change to check set of editing mode @audi
      (pointer === "crosshair" || pointer === "cursor-crosshair" || isEditing),
  );

  function getAnnotationPropertyStyle(annotation?: ImageAnnotationObject): IConfigPropertyStyles {
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
    <img id="idah-image" bind:this={target_container} {src} alt="" />
  </div>

  <svg
    bind:clientHeight={height}
    bind:clientWidth={width}
    class="h-full w-full"
    onmousemove={(e) => {
      mouse = [e.offsetX, e.offsetY];
    }}
    onmouseup={(e) => selectionEnd(e)}
    onmousedown={(e) => selectionStart(e)}
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
              .values.find((c) => c.id == $selectedAnnotation?.value?.category)?.color || "grey"
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
              .values.find((c) => c.id == $selectedAnnotation?.value?.category)?.color || "grey"
          : "grey"}
      />
    {/if}

    <!-- draw annotation context -->
    {#await annotations_promise}
      {#each $boundingBoxes as annotation (annotation.metadata.id)}
        {#if annotation.metadata.id != $selectedAnnotation?.metadata.id}
          {@const propertyStyle = getAnnotationPropertyStyle(annotation)}
          {#if annotation.shape.type == IMAGE_BOUNDING_BOX && !annotation.hidden}
            {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as ImageShape, frame)}
            {@const current_annotation_points = current_annotation_shape?.points || []}
            {@const current_annotation_angle = current_annotation_shape?.angle || 0}
            <BoundingBox
              mode={$currentMode}
              points={current_annotation_points as Point[]}
              angle={current_annotation_angle}
              ratio={target_size}
              {offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IMAGE_BOUNDING_BOX)?.[1]
                .values.find((c) => c.id == annotation.value?.category)?.color || "grey"}
              styles={propertyStyle}
              onmousedown={(e) => {
                e.stopPropagation();

                if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                  onSelectAnnotation(annotation);
                }

                if ($currentMode === IMAGE_NOTE) {
                  showNewNoteFeedPopup(annotation);
                }
              }}
            />
          {:else if annotation.shape.type == IMAGE_POLYGON && !annotation.hidden}
            <Polygon
              mode={$currentMode}
              points={(getInterpolatedFrame(annotation.shape as ImageShape, frame)?.points ||
                []) as InterpolatedVertex[]}
              ratio={target_size}
              {offset}
              color={Object.entries(context.config)
                .find(([k, _]) => k == IMAGE_POLYGON)?.[1]
                .values.find((c) => c.id == annotation.value?.category)?.color || "grey"}
              styles={propertyStyle}
              onmousedown={(e) => {
                e.stopPropagation();

                if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                  onSelectAnnotation(annotation);
                }

                if ($currentMode === IMAGE_NOTE) {
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
            {#if annotation.shape.type == IMAGE_BOUNDING_BOX && !annotation.hidden}
              {@const current_annotation_shape = getInterpolatedFrame(annotation.shape as ImageShape, frame)}
              {@const current_annotation_points = current_annotation_shape?.points || []}
              {@const current_annotation_angle = current_annotation_shape?.angle || 0}

              <BoundingBox
                mode={$currentMode}
                points={current_annotation_points as Point[]}
                angle={current_annotation_angle}
                ratio={target_size}
                {offset}
                color={annotation?.synced
                  ? Object.entries(context.config)
                      .find(([k, _]) => k == IMAGE_BOUNDING_BOX)?.[1]
                      .values.find((c) => c.id == annotation?.value?.category)?.color || "grey"
                  : "grey"}
                styles={propertyStyle}
                onmousedown={(e) => {
                  e.stopPropagation();

                  if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                    onSelectAnnotation(annotation);
                  }

                  if ($currentMode === IMAGE_NOTE) {
                    showNewNoteFeedPopup(annotation);
                  }
                }}
              />
            {:else if annotation.shape.type == IMAGE_POLYGON && !annotation.hidden}
              <Polygon
                mode={$currentMode}
                points={(getInterpolatedFrame(annotation.shape as ImageShape, frame)?.points ||
                  []) as InterpolatedVertex[]}
                ratio={target_size}
                {offset}
                color={annotation?.synced
                  ? Object.entries(context.config)
                      .find(([k, _]) => k == IMAGE_POLYGON)?.[1]
                      .values.find((c) => c.id == annotation?.value?.category)?.color || "grey"
                  : "grey"}
                styles={propertyStyle}
                onmousedown={(e) => {
                  e.stopPropagation();

                  if ($currentMode == DEFAULT_MODE || $selectedAnnotation) {
                    onSelectAnnotation(annotation);
                  }

                  if ($currentMode === IMAGE_NOTE) {
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
      {#if shape?.type == IMAGE_BOUNDING_BOX || $currentMode == IMAGE_BOUNDING_BOX}
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
            {offset}
            cursor={cursor_downscaled}
            hidden={$selectedAnnotation?.hidden}
            editable={(shape?.type == IMAGE_BOUNDING_BOX || $currentMode == IMAGE_BOUNDING_BOX) &&
              !$selectedAnnotation?.locked &&
              ["annotate", "review"].includes(context.workflowStep)}
            color={$selectedAnnotation?.synced
              ? Object.entries(context.config)
                  .find(([k, _]) => k == $currentMode)?.[1]
                  .values.find((c) => c.id == $selectedAnnotation?.value?.category)?.color || "grey"
              : "gray"}
            styles={propertyStyle}
            onChange={(bb, newAngle) => {
              onSelection(IMAGE_BOUNDING_BOX, frame, bb, newAngle, $selectedAnnotation?.metadata.id);
              points = bb;
            }}
          />
        {/key}
      {/if}

      {#if shape?.type == IMAGE_POLYGON || $currentMode == IMAGE_POLYGON}
        <Polygon
          bind:this={toolSelection}
          mode={$currentMode}
          points={points as Point[] | InterpolatedVertex[]}
          onEditingChange={(editing) => {
            isEditing = editing;
          }}
          onPointerChange={(c) => (editionCursor = c)}
          ratio={target_size}
          {offset}
          cursor={cursor_downscaled}
          hidden={$selectedAnnotation?.hidden}
          editable={(shape?.type == IMAGE_POLYGON || $currentMode == IMAGE_POLYGON) &&
            !$selectedAnnotation?.locked &&
            ["annotate", "review"].includes(context.workflowStep)}
          color={$selectedAnnotation?.synced
            ? Object.entries(context.config)
                .find(([k, _]) => k == $currentMode)?.[1]
                .values.find((c) => c.id == $selectedAnnotation?.value?.category)?.color || "grey"
            : "grey"}
          styles={propertyStyle}
          onChange={(polygon_points) => {
            onSelection(IMAGE_POLYGON, frame, polygon_points, 0, $selectedAnnotation?.metadata.id);
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
