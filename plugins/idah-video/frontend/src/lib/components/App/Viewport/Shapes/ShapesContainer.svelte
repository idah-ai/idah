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
  import BBoxCreateShape from "./BBoxCreateShape.svelte";
  import PolygonCreateShape from "./PolygonCreateShape.svelte";
  import Crosshair from "./Crosshair.svelte";

  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import type { IVideoAnnotationRecord } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";

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
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
    isPlaying: boolean;
  };

  let { frame, children, onSelection, onAddNewNote, isPlaying }: Props = $props();

  // ── SVG element ref ───────────────────────────────────────────────────
  let svgEl: SVGSVGElement | undefined = $state();

  // ── Mouse state ───────────────────────────────────────────────────────
  let mousePosition: Point = $state([0, 0]);

  // ── Derived viewport dimensions ──────────────────────────────────────
  let screenDimensions: Point = $derived<Point>(viewport.workspace.dimensions);

  // Cursor in scene space (passes through zoom/pan transform, but not media normalization)
  let normalizedMousePosition: Point = $derived([
    screenDimensions[0] > 0 ? mousePosition[0] / screenDimensions[0] : 0,
    screenDimensions[1] > 0 ? mousePosition[1] / screenDimensions[1] : 0,
  ] as Point);

  // Cursor in scene space (passes through zoom/pan transform, but not media normalization).
  // Used for rendering shapes that follow the cursor (crosshair, build previews) so they stay aligned with the content.
  let sceneMousePosition: Point = $derived.by(() => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [sv.x, sv.y] as Point;
  });

  // Cursor in normalized media space (0-1 relative to media dimensions)
  // This is the correct coordinate space for annotation shapes — passes through
  // scene transform (zoom/pan) so it always stays aligned with the content.
  let sceneNormalizedCursor: Point = $derived.by((): Point => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [media.width > 0 ? sv.x / media.width : 0, media.height > 0 ? sv.y / media.height : 0];
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
    selection.value?.type === "annotation" ? (selection.value.annotation as any) : undefined,
  );

  let toolSelection = $derived.by(() => {
    const selId = selection.value?.type === "annotation" ? selection.value.annotation?.id : null;
    if (!selId) return undefined;
    const idx = visibleAnnotations.findIndex((a) => a.id === selId);
    if (idx === -1) return undefined;
    return _compRefs[idx]?.getToolSelection();
  });

  // ── Create shape component refs ───────────────────────────────────────
  let bboxCreateComp: BBoxCreateShape | undefined = $state(undefined);
  let polygonCreateComp: PolygonCreateShape | undefined = $state(undefined);

  // ── Mode constants ────────────────────────────────────────────────────
  const NOTE_MODE = "note";
  const BOUNDING_BOX_MODE = "idah-video:bounding-box";
  const POLYGON_MODE = "idah-video:polygon";

  let isBoundingBoxMode = $derived(viewport.mode === BOUNDING_BOX_MODE);
  let isPolygonMode = $derived(viewport.mode === POLYGON_MODE);
  let isNoteMode = $derived(viewport.mode === NOTE_MODE);

  // ── Panning state ────────────────────────────────────────────────────
  let isPanning = $state(false);
  let isDragging = $state(false);

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

    // Fit video to viewport on initial load
    requestAnimationFrame(() => viewport.workspace.fitToViewport());

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
    if (isNoteMode) return "cursor-note";
    if (viewport.isCreationMode) return "cursor-crosshair";
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

  const viewBox = $derived.by(() => {
    const [tx, ty] = viewport.workspace.transform.translate;
    const [w, h] = viewport.workspace.dimensions;
    const s = viewport.workspace.transform.scale;
    return `${-tx / s} ${-ty / s} ${w / s} ${h / s}`;
  });

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
    // Sync mousePosition so the cursor prop used by shape components
    // reflects the actual click position (not the last mousemove).
    mousePosition = [e.offsetX, e.offsetY];

    // ── Polygon creation mode — delegate to PolygonCreateShape ─────
    if (isPolygonMode) {
      e.stopPropagation();
      polygonCreateComp?.handleMouseDown(sceneNormalizedCursor);
      return;
    }

    // ── Bounding-box creation mode — delegate to BBoxCreateShape ───
    if (isBoundingBoxMode) {
      bboxCreateComp?.handleMouseDown(sceneNormalizedCursor);
      return;
    }

    // ── Note mode — defer to mouseup ───────────────────────────────
    if (isNoteMode) {
      return;
    }

    // ── Default mode: try editing selected annotation ──────────────
    if (toolSelection) {
      const consumed = toolSelection.startSelection(sceneNormalizedCursor, e.shiftKey);
      if (consumed) {
        e.stopPropagation();
        return;
      }
    }

    // Nothing hit — deselect and start panning
    selection.deselect();
    zoomableElement.mouseDown(e);
  }

  function onMouseLeave(_e: MouseEvent) {
    // Cancel any active tool edit (bounding box drag, resize, rotate)
    toolSelection?.endSelection(sceneNormalizedCursor);
    // Stop viewport panning
    zoomableElement.mouseUp(new MouseEvent("mouseup"));
  }

  function onMouseUp(e: MouseEvent) {
    // ── Bounding-box creation mode — finalize on BBoxCreateShape ──
    if (isBoundingBoxMode) {
      bboxCreateComp?.handleMouseUp(sceneNormalizedCursor);
      return;
    }

    // Note mode — show new note popup anchored to cursor position
    if (isNoteMode) {
      showNewNoteFeedPopup();
      return;
    }

    // Default mode: finalize edit operation
    toolSelection?.endSelection(sceneNormalizedCursor);

    // Only pan on mouseup if we were panning
    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IVideoAnnotationRecord) {
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
      annotationId: (annotation?.metadata?.id as string | undefined) || null,
    });
  }

  function handleEditComplete(annId: string, points: Point[], angle: number) {
    onSelection(viewport.mode, frame, points, angle, annId);
  }

  function handleClick(ann: IAnnotationRecord) {
    // Don't select annotations in polygon creation mode
    if (isPolygonMode) return;

    // Don't select already selected annotation
    if (selection.isAnnotationSelected(ann.id)) return;

    selection.selectAnnotation(ann);
  }
</script>

<div class={cn("shapes-container flex-1", pointer)}>
  <!-- Layer 0: Viewport with video content -->
  <div class="viewport-layer">
    <Viewport bind:this={zoomableElement} onPanStart={() => (isPanning = true)} onPanStop={() => (isPanning = false)}>
      {@render children?.()}
    </Viewport>
  </div>

  <!-- Layer 1: SVG overlay for shapes -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    width="100%"
    height="100%"
    {viewBox}
    onkeydown={() => {}}
    bind:this={svgEl}
    onmousedown={onMouseDown}
    onmouseup={onMouseUp}
    onmousemove={onMouseMove}
    onmouseleave={onMouseLeave}
    onwheel={onWheel}
  >
    <!-- Crosshair (for build modes) -->
    <Crosshair cursor={sceneMousePosition} visible={showCrosshair} />

    <g>
      <!-- Build mode: bounding box creation preview -->
      {#if isBoundingBoxMode}
        <BBoxCreateShape
          bind:this={bboxCreateComp}
          cursor={sceneNormalizedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {frame}
          {onSelection}
        />
      {/if}

      <!-- Build mode: polygon creation preview -->
      {#if isPolygonMode}
        <PolygonCreateShape
          bind:this={polygonCreateComp}
          cursor={sceneNormalizedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {frame}
          {onSelection}
        />
      {/if}

      <!-- Rendered annotations -->
      {#each visibleAnnotations as ann, i (ann.id)}
        <AnnotationGeometry
          bind:this={_compRefs[i]}
          annotation={ann}
          selected={selection.isAnnotationSelected(ann.id)}
          editable={viewport.mode === "default" && selection.isAnnotationSelected(ann.id)}
          cursor={sceneNormalizedCursor}
          mode={viewport.mode}
          onClick={() => handleClick(ann)}
          onEditComplete={(aabb: Point[], angle: number) => handleEditComplete(ann.id, aabb, angle)}
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
