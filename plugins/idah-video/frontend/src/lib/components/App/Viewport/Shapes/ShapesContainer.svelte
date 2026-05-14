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
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import type { IVideoAnnotationRecord } from "$lib/types";
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

  let normalizedMousePosition: Point = $derived([
    screenDimensions[0] > 0 ? mousePosition[0] / screenDimensions[0] : 0,
    screenDimensions[1] > 0 ? mousePosition[1] / screenDimensions[1] : 0,
  ] as Point);

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

  // ── Build mode state ─────────────────────────────────────────────────
  const BUILD_MODE = "idah-video:bounding-box";
  const POLYGON_MODE = "idah-video:polygon";
  let buildStart: Point | undefined = $state();

  // ── Polygon build state ──────────────────────────────────────────────
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
  let svgTransform = "";
  // let svgTransform = $derived(
  //   `translate(${viewport.workspace.transform.translate[0]}px, ${viewport.workspace.transform.translate[1]}px) scale(${viewport.workspace.transform.scale})`,
  // );

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

    const isBuildMode = viewport.mode === BUILD_MODE;
    const isPolyMode = viewport.mode === POLYGON_MODE;

    // ── Polygon creation mode — check BEFORE tool selection ──────────
    if (isPolyMode) {
      e.stopPropagation();
      if (polygonDraft.points.length >= 3) {
        const first = polygonDraft.points[0];
        const dx = Math.abs(sceneNormalizedCursor[0] - first[0]) * media.width;
        const dy = Math.abs(sceneNormalizedCursor[1] - first[1]) * media.height;
        if (dx * dx + dy * dy < 400) {
          const pts = [...polygonDraft.points];
          polygonDraft.reset();
          // Route through onSelection so the workspace can apply pendingValue (selected category)
          onSelection("idah-video:polygon", frame, pts, 0, undefined);
          return;
        }
      }
      getDriver().command.call("annotation.polygon.add_point", { point: sceneNormalizedCursor });
      return;
    }

    // If an annotation is already selected, try editing it (but NOT in polygon mode)
    if (toolSelection) {
      const consumed = toolSelection.startSelection(sceneNormalizedCursor, e.shiftKey);
      if (consumed) {
        e.stopPropagation();
        return;
      }
    }

    if (isBuildMode) {
      buildStart = sceneNormalizedCursor;
      return;
    }

    if (viewport.mode === "note") {
      return;
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
    const isBuildMode = viewport.mode === BUILD_MODE;

    if (isBuildMode && buildStart) {
      // Finalize new bounding box
      const end = sceneNormalizedCursor;
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
    toolSelection?.endSelection(sceneNormalizedCursor);

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
        annotationId: (annotation?.metadata?.id as string | undefined) || null,
      });
    }
  }

  function handleEditComplete(annId: string, points: Point[], angle: number) {
    onSelection(viewport.mode, frame, points, angle, annId);
  }

  function handleClick(ann: IAnnotationRecord) {
    // Don't select annotations in polygon creation mode
    if (viewport.mode === POLYGON_MODE) return;
    if (selection.value?.type === "annotation" && selection.value.annotation?.id === ann.id) return;
    selection.selectAnnotation(ann);
    getDriver().command.call("timeline.focus");
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
        {@const sx = buildStart[0] * media.width}
        {@const sy = buildStart[1] * media.height}
        {@const cx = sceneNormalizedCursor[0] * media.width}
        {@const cy = sceneNormalizedCursor[1] * media.height}
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

      <!-- Polygon draft preview: lines connecting placed points + line to cursor -->
      {#if viewport.mode === POLYGON_MODE && polygonDraft.points.length > 0}
        {@const pts = polygonDraft.points}
        {@const cursorPos = sceneNormalizedCursor}
        <!-- Draw path connecting all placed points -->
        <polyline
          points={pts.map((p) => `${p[0] * media.width},${p[1] * media.height}`).join(" ")}
          fill="none"
          stroke="rgba(246, 64, 43, 0.8)"
          stroke-width="2"
          stroke-dasharray="4,2"
          vector-effect="non-scaling-stroke"
        />
        <!-- Line from last point to cursor -->
        {#if pts.length > 0}
          <line
            x1={pts[pts.length - 1][0] * media.width}
            y1={pts[pts.length - 1][1] * media.height}
            x2={cursorPos[0] * media.width}
            y2={cursorPos[1] * media.height}
            stroke="rgba(246, 64, 43, 0.4)"
            stroke-width="1.5"
            stroke-dasharray="3,3"
            vector-effect="non-scaling-stroke"
          />
        {/if}
        <!-- Vertex dots at each placed point -->
        {#each pts as p}
          <circle
            cx={p[0] * media.width}
            cy={p[1] * media.height}
            r={4}
            fill="rgba(246, 64, 43, 0.9)"
            stroke="white"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
        {/each}
        <!-- Highlight first point (close target) -->
        <circle
          cx={pts[0][0] * media.width}
          cy={pts[0][1] * media.height}
          r={6}
          fill="none"
          stroke="rgba(246, 64, 43, 0.9)"
          stroke-width="2"
          stroke-dasharray="2,2"
          vector-effect="non-scaling-stroke"
        />
      {/if}

      {#each visibleAnnotations as ann, i (ann.id)}
        <AnnotationGeometry
          bind:this={_compRefs[i]}
          annotation={ann}
          selected={selection.value?.type === "annotation" && selection.value.annotation?.id === ann.id}
          editable={viewport.mode === "default" &&
            selection.value?.type === "annotation" &&
            selection.value.annotation?.id === ann.id}
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
