<script lang="ts">
  // ---------------------------------------------------------------------------
  // ShapesContainer.svelte — SVG overlay + shape rendering for the viewport
  //
  // Replaces the old SvgOverlay + ShapeContainer pair with a single clean
  // component. Responsibilities:
  //   • Wraps <Video> inside a <Viewport> (pan/zoom)
  //   • Renders an SVG layer on top with crosshair, build-mode preview, etc.
  //   • Filters visible annotations by current frame and renders them via
  //     AnnotationGeometry
  //   • Handles mouse events for selection, panning, and build-mode creation
  //   • Exposes zoomIn/zoomOut helpers
  // ---------------------------------------------------------------------------

  import { onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";
  import AnnotationGeometry from "./AnnotationGeometry.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import type { IVideoAnnotationRecord } from "$idah/v2/video-types";
  import type { Point } from "$lib/utils/math/point";
  import type { BBox } from "$lib/utils/math/bbox";

  // ── Types ──────────────────────────────────────────────────────────────
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
    onSelection: (
      type: string,
      frame: number,
      points?: Point[],
      angle?: number,
      id?: string,
    ) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
    isPlaying: boolean;
  };

  let {
    frame,
    children,
    onSelection,
    onAddNewNote,
    isPlaying,
  }: Props = $props();

  // ── SVG element ref ───────────────────────────────────────────────────
  let svgEl: SVGSVGElement | undefined = $state();

  // ── Mouse state ───────────────────────────────────────────────────────
  let mousePosition: Point = $state([0, 0]);

  // ── Derived viewport dimensions ──────────────────────────────────────
  let screenDimensions: Point = $derived<Point>(viewport.workspace.dimensions);

  let normalizedMousePosition: Point = $derived([
    screenDimensions[0] > 0 ? mousePosition[0] / screenDimensions[0] : 0,
    screenDimensions[1] > 0 ? mousePosition[1] / screenDimensions[1] : 0,
  ] as Point);

  let sceneMousePosition: Point = $derived.by(() => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [sv.x, sv.y] as Point;
  });

  // ── Viewport ref ──────────────────────────────────────────────────────
  let zoomableElement: Viewport;

  // ── Component refs for tool selection ─────────────────────────────────
  let _compRefs: any[] = $state([]);

  // Build a flat list of visible annotations (filtered by current frame)
  let visibleAnnotations = $derived.by<IAnnotationRecord[]>(() => {
    const f = viewport.video.currentFrame.value;
    const items = data.annotations?.items ?? [];
    return items.filter((ann) => {
      const s = ann.shape as { start?: number; end?: number };
      return s.start != null && s.end != null && f >= s.start && f <= s.end;
    });
  });

  // Keep refs array sized to match visible annotations
  $effect(() => {
    if (_compRefs.length < visibleAnnotations.length) {
      _compRefs.length = visibleAnnotations.length;
    }
  });

  // Derive tool selection from the currently selected annotation's component
  let selAnnotation = $derived(
    selection.value?.type === "annotation"
      ? (selection.value.annotation as any)
      : undefined,
  );

  let toolSelection = $derived.by(() => {
    const selId =
      selection.value?.type === "annotation"
        ? selection.value.annotation?.id
        : null;
    if (!selId) return undefined;
    const idx = visibleAnnotations.findIndex((a) => a.id === selId);
    if (idx === -1) return undefined;
    return _compRefs[idx]?.getToolSelection();
  });

  // ── Build mode state ─────────────────────────────────────────────────
  const BUILD_MODE = "idah-video:bounding-box";
  let buildStart: Point | undefined = $state();

  // ── Panning state ────────────────────────────────────────────────────
  let isPanning = $state(false);

  // ── Resize observer to sync dimensions ────────────────────────────────
  function syncDimensions() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewport.workspace.dimensions[0] = rect.width;
    viewport.workspace.dimensions[1] = rect.height;
  }

  onMount(() => {
    const ro = new ResizeObserver(() => syncDimensions());
    if (svgEl) ro.observe(svgEl);
    syncDimensions();

    // Add a tiny stylesheet for cursor classes
    const style = document.createElement("style");
    style.textContent = `
      .cursor-note { cursor: crosshair; }
      .cursor-crosshair { cursor: crosshair; }
      .cursor-grab { cursor: grab; }
      .cursor-grabbing { cursor: grabbing; }
      .cursor-pointer { cursor: pointer; }
    `;
    document.head.appendChild(style);

    return () => {
      ro.disconnect();
      document.head.removeChild(style);
    };
  });

  // ── Exported zoom helpers ────────────────────────────────────────────
  export function zoomIn() {
    zoomableElement.zoomIn();
  }
  export function zoomOut() {
    zoomableElement.zoomOut();
  }

  // ── Cursor class ─────────────────────────────────────────────────────
  let pointer = $derived.by(() => {
    if (viewport.mode === "note") return "cursor-note";
    if (viewport.mode === BUILD_MODE) return "cursor-crosshair";
    if (selAnnotation) return "cursor-pointer";
    if (isPanning) return "cursor-grabbing";
    return "cursor-grab";
  });

  let showCrosshair = $derived(
    screenDimensions[0] > 0 &&
      screenDimensions[1] > 0 &&
      !isPlaying &&
      viewport.mode !== "default" &&
      viewport.mode !== "note",
  );

  // ── SVG transform ────────────────────────────────────────────────────
  let svgTransform = ''
  // let svgTransform = $derived(
  //   `translate(${viewport.workspace.transform.translate[0]}px, ${viewport.workspace.transform.translate[1]}px) scale(${viewport.workspace.transform.scale})`,
  // );

  const viewBox = $derived.by(() => {
    const [tx, ty] = viewport.workspace.transform.translate
    const [w, h] = viewport.workspace.dimensions
    const s = viewport.workspace.transform.scale
    return [
      -tx/s,
      -ty/s,
      (w/s),
      (h/s)
    ]
  })

  // ── Event handlers ───────────────────────────────────────────────────
  function onMouseMove(e: MouseEvent) {
    mousePosition = [e.offsetX, e.offsetY];
    // Only pan in default mode
    if (viewport.mode === "default") {
      zoomableElement.mouseMove(e);
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoomableElement.onWheel(e);
  }

  function onMouseDown(e: MouseEvent) {
    const isBuildMode = viewport.mode === BUILD_MODE;

    if (isBuildMode) {
      buildStart = normalizedMousePosition;
      return;
    }

    if (viewport.mode === "note") {
      // Note mode: do nothing on mousedown (creation happens on mouseup)
      return;
    }

    // Default mode: try editing first, fall back to pan
    if (toolSelection) {
      const consumed = toolSelection.startSelection(normalizedMousePosition);
      if (consumed) {
        e.stopPropagation();
        return;
      }
    }

    // Nothing hit — deselect and start panning
    selection.deselect();
    zoomableElement.mouseDown(e);
  }

  function onMouseUp(e: MouseEvent) {
    const isBuildMode = viewport.mode === BUILD_MODE;

    if (isBuildMode && buildStart) {
      // Finalize new bounding box
      const end = normalizedMousePosition;
      const x1 = Math.min(buildStart[0], end[0]);
      const y1 = Math.min(buildStart[1], end[1]);
      const x2 = Math.max(buildStart[0], end[0]);
      const y2 = Math.max(buildStart[1], end[1]);
      buildStart = undefined;

      // Minimum size threshold (normalized: 0.5%)
      if (Math.abs(x2 - x1) < 0.005 || Math.abs(y2 - y1) < 0.005) return;

      const points: Point[] = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ];
      onSelection(viewport.mode, frame, points, 0, undefined);
      return;
    }

    if (viewport.mode === "note") {
      showNewNoteFeedPopup();
      return;
    }

    // Default mode: finalize edit operation
    toolSelection?.endSelection(normalizedMousePosition);

    // Only pan on mouseup if we were panning
    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IVideoAnnotationRecord) {
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
        annotationId: annotation?.metadata?.id || null,
      });
    }
  }

  function handleEditComplete(annId: string, aabb: BBox, angle: number) {
    const points: Point[] = [
      [aabb[0], aabb[1]],
      [aabb[2], aabb[1]],
      [aabb[2], aabb[3]],
      [aabb[0], aabb[3]],
    ];
    onSelection(viewport.mode, frame, points, angle, annId);
  }

  function handleClick(ann: IAnnotationRecord) {
    if (
      selection.value?.type === "annotation" &&
      selection.value.annotation?.id === ann.id
    )
      return;
    selection.selectAnnotation(ann);
  }
</script>

<div class={cn("shapes-container flex-1", pointer)}>
  <!-- Layer 0: Viewport with video content -->
  <div class="viewport-layer">
    <Viewport
      bind:this={zoomableElement}
      onPanStart={() => (isPanning = true)}
      onPanStop={() => (isPanning = false)}
    >
      {@render children?.()}
    </Viewport>
  </div>

  <!-- Layer 1: SVG overlay for shapes -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    width="100%"
    height="100%"
    viewBox={viewBox}
    onkeydown={() => {}}
    bind:this={svgEl}
    onmousedown={onMouseDown}
    onmouseup={onMouseUp}
    onmousemove={onMouseMove}
    onwheel={onWheel}
  >
    <!-- Crosshair (for build modes) -->
    {#if showCrosshair}
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

    <g>
      <!-- Build mode preview: dashed rectangle from start to current cursor -->
      {#if viewport.mode === BUILD_MODE && buildStart}
        {@const sx = buildStart[0] * screenDimensions[0]}
        {@const sy = buildStart[1] * screenDimensions[1]}
        {@const cx = normalizedMousePosition[0] * screenDimensions[0]}
        {@const cy = normalizedMousePosition[1] * screenDimensions[1]}
        <rect
          x={Math.min(sx, cx)}
          y={Math.min(sy, cy)}
          width={Math.abs(cx - sx)}
          height={Math.abs(cy - sy)}
          fill="rgba(246, 64, 43, 0.15)"
          stroke="rgba(246, 64, 43, 0.8)"
          stroke-width="2"
          stroke-dasharray="6,3"
          vector-effect="non-scaling-stroke"
        />
      {/if}

      {#each visibleAnnotations as ann, i (ann.id)}
        <AnnotationGeometry
          bind:this={_compRefs[i]}
          annotation={ann}
          selected={
            selection.value?.type === "annotation" &&
            selection.value.annotation?.id === ann.id
          }
          editable={
            viewport.mode === "default" &&
            selection.value?.type === "annotation" &&
            selection.value.annotation?.id === ann.id
          }
          cursor={normalizedMousePosition}
          mode={viewport.mode}
          onClick={() => handleClick(ann)}
          onEditComplete={(aabb: BBox, angle: number) =>
            handleEditComplete(ann.id, aabb, angle)}
        />
      {/each}
    </g>
  </svg>
</div>

<style>
  .shapes-container {
    position: relative;
    overflow: hidden;
  }

  .shapes-container > .viewport-layer {
    position: absolute;
    width: 100%;
    height: 100%;
  }

  .shapes-container > svg {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
