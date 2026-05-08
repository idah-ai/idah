<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";
  import ShapeContainer from "$lib/components/App/Viewport/ShapesV2/ShapeContainer.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import type { ToolSelection } from "$lib/components/App/Viewport/Shapes/BoundingBox/BoundingBox.svelte";
  import type { IVideoAnnotationRecord, IVideoAnnotationShape } from "$idah/v2/video-types";
  import type { Point } from "$lib/utils/math/point";

  // Local derived aliases for V2 state (used in templates)
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value.annotation as any) : undefined,
  );

  // Types
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
  }

  type Props = {
    frame: number;
    annotations_promise: Promise<IVideoAnnotationRecord[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: IVideoAnnotationRecord) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmousemove?: (e: MouseEvent) => void;
    onwheel?: (e: WheelEvent) => void;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
    isPlaying: boolean;
  };
  let {
    frame,
    annotations_promise,
    onSelectAnnotation,
    onSelection,
    onAddNewNote,
    onChangeFrame,
    children,
    isPlaying,
  }: Props = $props();

  let svgEl: SVGSVGElement | undefined = $state();

  // Derive viewport annotations from the global store
  let viewportItems = $derived.by<IVideoAnnotationRecord[]>(() => {
    const raw = data.annotations?.items ?? [];
    return raw.map((ann) => {
      const shape = ann.shape as IVideoAnnotationShape;
      return {
        shape,
        value: {
          category: (ann.category ?? ann.value?.category) || "null",
          attributes: ann.value?.attributes ?? {},
        },
        metadata: ann.metadata ?? {
          id: ann.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
        hidden: ann.hidden ?? false,
        locked: ann.locked ?? false,
        synced: ann.synced ?? true,
      } as IVideoAnnotationRecord;
    });
  });

  // Sync dimensions using ResizeObserver (no $effect)
  function syncDimensions() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewport.workspace.dimensions[0] = rect.width;
    viewport.workspace.dimensions[1] = rect.height;
  }

  let mousePosition: Point = $state([0, 0]);

  let screenDimensions: Point = $derived<Point>(viewport.workspace.dimensions);

  // TODO: find a better way to pass shape initialization

  let pendingShape: Record<string, unknown> | undefined = $state();

  let activePoints: Point[] | undefined = $state();
  let activeAngle: number | undefined = $state();

  let sceneMousePosition: Point = $derived.by(() => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [sv.x, sv.y] as Point;
  });

  let normalizedMousePosition: Point = $derived([
    mousePosition[0] / screenDimensions[0],
    mousePosition[1] / screenDimensions[1],
  ] as Point);

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
    const EDITOR_MODE_TOOLS = ["idah-video:bounding-box", "idah-video:polygon"];
    const isDrawingMode = EDITOR_MODE_TOOLS.includes(viewport.mode) && viewport.mode !== "default";

    if (!pendingShape && !isDrawingMode) {
      selection.deselect();
      zoomableElement.mouseDown(e);
      return;
    }

    toolSelection?.startSelection(normalizedMousePosition);

    if (!isEditing && EDITOR_MODE_TOOLS.includes(viewport.mode)) {
      if (!toolSelection) {
        console.error(
          "no tool for mode: ",
          viewport.mode,
          " is found, deselecting annotation and reverting to mode: ",
          "default",
        );
      }
      return;
    }

    onSelectAnnotation();
    zoomableElement.mouseDown(e);
    selection.deselect();
  }

  export function selectionEnd(e: MouseEvent) {
    toolSelection?.endSelection(normalizedMousePosition);

    showNewNoteFeedPopup();

    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IVideoAnnotationRecord) {
    /**
     * Show new note feed dialog only when there is no dragging (i.e. zoom offset did not change)
     */
    if (viewport.mode === "note") {
      onAddNewNote({
        anchorType: annotation ? "annotation" : "entry",
        position: {
          x: normalizedMousePosition[0],
          y: normalizedMousePosition[1],
          start: frame,
          end: frame,
          target_size: screenDimensions,
          zoom_info: {
            scale: viewport.workspace.transform.scale,
            offset: viewport.workspace.transform.translate,
          },
        },
        annotationId: annotation?.metadata.id || null,
      });
    }
  }

  onMount(() => {
    // Sync dimensions on mount and on resize (no $effect)
    const ro = new ResizeObserver(() => syncDimensions());
    if (svgEl) ro.observe(svgEl);
    syncDimensions();

    async function setNoteModeCursor() {
      // Use a simple fallback cursor for note mode
      const style = document.createElement("style");
      style.textContent = `
        .cursor-note {
          cursor: crosshair;
        }
      `;
      document.head.appendChild(style);
    }

    setNoteModeCursor();

    return () => ro.disconnect();
  });

  let isEditing = $state(false);
  let editionCursor: string | undefined = $state(undefined);
  let isPanning = $state(false);

  // Reset editionCursor when switching to visual mode without selection
  $effect(() => {
    if (viewport.mode === "default" && !selAnnotation) {
      editionCursor = undefined;
    }
  });

  let pointer = $derived.by(() => {
    if (viewport.mode == "note") return "cursor-note";
    if (editionCursor) return editionCursor;
    if (selAnnotation) return "cursor-pointer";
    if (isPanning) return "cursor-grabbing";
    return "cursor-grab";
  });

  let showCrosshair = $derived(
    screenDimensions[0] > 0 &&
      screenDimensions[1] > 0 &&
      !isPlaying &&
      !["note", "default"].includes(viewport.mode) && // TODO:: Change to check set of editing mode @audi
      (pointer === "crosshair" || pointer === "cursor-crosshair" || isEditing),
  );

  function getAnnotationPropertyStyle(annotation?: IVideoAnnotationRecord): { border?: string; opacity?: number } {
    const defaultStyle = {
      border: "solid" as const,
      opacity: 100,
    };
    if (!annotation) return defaultStyle;

    const assignedAttributes = annotation.value.attributes || {};

    // Determine which config to use based on annotation shape type
    const configKey = annotation.shape.type;

    const assignedAttributeProperties =
      Object.entries(getDriver().config)
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

  // Workspace transform for the SVG overlay
  let svgTransform = $derived(
    `translate(${viewport.workspace.transform.translate[0]}px, ${viewport.workspace.transform.translate[1]}px) scale(${viewport.workspace.transform.scale})`,
  );
</script>

<div class={cn("svg-overlay flex-1", pointer)}>
  <div>
    <Viewport
      bind:this={zoomableElement}
      onPanStart={() => (isPanning = true)}
      onPanStop={() => (isPanning = false)}
    >
      {@render children?.()}
    </Viewport>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    width="100%"
    height="100%"
    onkeydown={() => {}}
    bind:this={svgEl}
    onmousedown={(e) => {
      selectionStart(e);
    }}
    onmouseup={(e) => {
      selectionEnd(e);
    }}
    onmousemove={(e) => {
      // const elementRect = svg.getBoundingClientRect();

      // mouse = [e.layerX, e.layerY] //..
      mousePosition = [e.offsetX, e.offsetY]; //..
      // mouse[0] = e.pageX - (Math.round(elementRect.left) + window.scrollX);
      // mouse[1] = e.pageY - (Math.round(elementRect.top) + window.scrollY);
      // console.log({mouse:{x: mouse[0], y:mouse[1]}, e})
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
        x1={sceneMousePosition[0] - 10000}
        y1={sceneMousePosition[1]}
        x2={sceneMousePosition[0] + 10000}
        y2={sceneMousePosition[1]}
        stroke="rgba(100,100,100,0.25)"
        stroke-width="1"
      />
      <line
        x1={sceneMousePosition[0]}
        y1={sceneMousePosition[1] - 10000}
        x2={sceneMousePosition[0]}
        y2={sceneMousePosition[1] + 10000}
        stroke="rgba(100,100,100,0.25)"
        stroke-width="1"
      />
    {/if}

    <g style:transform-origin="top left" style:transform={svgTransform}>
      <ShapeContainer />
    </g>
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
