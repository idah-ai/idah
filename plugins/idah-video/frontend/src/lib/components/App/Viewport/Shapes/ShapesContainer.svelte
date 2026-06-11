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
  import NoteMarkers from "$lib/components/App/NoteMarkers.svelte";

  import { BOUNDING_BOX_MODE, EDITOR_MODE, NOTE_MODE, POLYGON_MODE, REVIEW_MODE, viewport } from "$lib/state/viewport.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { selection, type IAnnotationSelection } from "$lib/state/selection.svelte";
  import { data, setPendingNoteScene } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import type { IVideoAnnotationRecord, IVideoAnnotationShape } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { centroid as centroidUtil } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";

  // ── Types ──────────────────────────────────────────────────────────────
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
    /** SVG-relative pixel coords for popup placement. */
    screenX?: number;
    screenY?: number;
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

  // Build a flat list of visible annotations (filtered by current frame and hidden state).
  // The list is ordered so the selected annotation always comes last (highest z-order
  // in SVG), and non-selected annotations are ordered by creation (earliest first).
  // This ensures overlapping shapes always have the selected one on top.
  //
  // Performance note: uses a single O(n) reduce pass to both filter visibility and
  // separate the selected annotation — no extra findIndex() pass needed.
  let visibleAnnotations = $derived.by<IAnnotationRecord[]>(() => {
    const frame = viewport.video.currentFrame.value;
    const items = data.annotations?.items ?? [];

    // Single-pass: filter visible annotations while partitioning selected vs rest
    const { rest, selected } = items.reduce<{
      rest: IAnnotationRecord[];
      selected: IAnnotationRecord[];
    }>(
      (acc, ann) => {
        // Skip hidden annotations
        if (annotation.isHidden(ann)) return acc;
        // Skip annotations outside the current frame range
        const { start, end } = (ann.shape ?? {}) as { start?: number; end?: number };
        if (start == null || end == null || frame < start || frame > end) return acc;
        // Separate selected annotation (goes at end for z-order) from the rest
        if (selection.isAnnotationSelected(ann.id)) {
          acc.selected.push(ann);
        } else {
          acc.rest.push(ann);
        }
        return acc;
      },
      { rest: [], selected: [] },
    );

    // Sort non-selected by creation order (earliest first) for stable z-ordering.
    // The selected annotation is appended unsorted — only one, so no sort needed.
    rest.sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return aTime - bTime;
    });

    return [...rest, ...selected];
  });

  // Keep refs array sized to match visible annotations
  $effect(() => {
    if (_compRefs.length < visibleAnnotations.length) {
      _compRefs.length = visibleAnnotations.length;
    }
  });

  // Derive tool selection from the currently selected annotation's component
  let selAnnotation = $derived(
    selection.isAnnotation() ? (selection.value as IAnnotationSelection).annotation : undefined,
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
    viewport.svgElement = svgEl ?? null;
    const ro = new ResizeObserver(() => syncDimensions());
    if (svgEl) ro.observe(svgEl);
    syncDimensions();

    // Fit video to viewport on initial load
    requestAnimationFrame(() => viewport.workspace.fitToViewport());

    // Add a tiny stylesheet for cursor classes
    const style = document.createElement("style");
    style.textContent = `
      .cursor-note { cursor: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNC45ODkgMjEuNTU2YTIuNjY3IDIuNjY3IDAgMCAxIC4xMjUgMS41NTZsLTEuNDIgNC4zODdhMS4zMzMgMS4zMzMgMCAwIDAgMS42NDggMS41NThsNC41NTEtMS4zMzFhMi42NjcgMi42NjcgMCAwIDEgMS40NjUuMTIzIDEzLjMzMyAxMy4zMzMgMCAxIDAtNi4zNjktNi4yOTJ6IiBmaWxsPSIjNmI3MGIwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+'), auto; }
      .cursor-crosshair { cursor: crosshair; }
      .cursor-grab { cursor: grab; }
      .cursor-grabbing { cursor: grabbing; }
      .cursor-pointer { cursor: pointer; }
      .cursor-target { cursor: alias; }
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

  // ── Check if cursor is hovering the first polygon draft point ────────
  let hoveringFirstPoint = $derived(
    isPolygonMode && nearFirstPolygonPoint(sceneNormalizedCursor, media.width, media.height, polygonDraft.points),
  );

  // ── Cursor class ─────────────────────────────────────────────────────
  let pointer = $derived.by(() => {
    if (hoveringFirstPoint) return "cursor-target";
    if (viewport.isCreationMode) return "cursor-crosshair";
    if (isNoteMode) return "cursor-note";
    if (selAnnotation) return "cursor-pointer";
    if (isPanning) return "cursor-grabbing";

    return "cursor-grab";
  });

  let showCrosshair = $derived(
    screenDimensions[0] > 0 &&
      screenDimensions[1] > 0 &&
      !isPlaying &&
      viewport.mode !== EDITOR_MODE &&
      viewport.mode !== REVIEW_MODE &&
      viewport.mode !== NOTE_MODE,
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
    // Only pan in editor mode
    if (viewport.mode === EDITOR_MODE || viewport.mode === REVIEW_MODE) {
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

    // ── Review mode: deselect and start panning (no shape editing) ─
    if (viewport.mode === REVIEW_MODE) {
      selection.deselect();
      zoomableElement.mouseDown(e);
      return;
    }

    // ── Default mode: try editing selected annotation ──────────────
    if (toolSelection && isEditable()) {
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

    // Note mode — entry-note creation is handled via onClick on the <svg> element,
    // not onMouseUp, because shape components call stopPropagation on mousedown
    // which prevents mouseup from bubbling. The click event fires regardless.
    if (isNoteMode) {
      return;
    }

    // Default mode: finalize edit operation
    toolSelection?.endSelection(sceneNormalizedCursor);

    // Only pan on mouseup if we were panning
    zoomableElement.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IVideoAnnotationRecord) {
    // Use scene-normalized cursor so markers track video content under pan/zoom.
    // sceneNormalizedCursor is in 0-1 normalized media space.
    const params: OnAddNewNoteParams = {
      anchorType: annotation ? ("annotation" as const) : ("entry" as const),
      position: {
        x: sceneNormalizedCursor[0],
        y: sceneNormalizedCursor[1],
        frame,
      },
      annotationId: (annotation?.metadata?.id as string | undefined) || null,
      screenX: mousePosition[0],
      screenY: mousePosition[1],
    };
    // Show a temporary marker at the click position
    setPendingNoteScene({
      x: sceneNormalizedCursor[0] * media.width,
      y: sceneNormalizedCursor[1] * media.height,
    });
    onAddNewNote(params);
    // Exit note tool mode — return to review workspace
    getDriver().setMode("review");
  }

  function onSvgClick(e: MouseEvent) {
    // Note mode: if the click wasn't already handled by an annotation's onclick,
    // create an entry-level note at the click position.
    if (isNoteMode && !_noteHandledByClick) {
      mousePosition = [e.offsetX, e.offsetY];
      showNewNoteFeedPopup();
    }
    _noteHandledByClick = false;
  }

  function handleEditComplete(annId: string, points: Point[], angle: number) {
    onSelection(viewport.mode, frame, points, angle, annId);
  }

  let _noteHandledByClick = false;

  function handleClick(ann: IAnnotationRecord) {
    // Note mode: create an annotation-anchored note
    if (isNoteMode) {
      _noteHandledByClick = true;

      // Compute annotation centroid at current frame for offset
      const shape = (ann as any).shape as IVideoAnnotationShape | undefined;
      let centroidN: [number, number] = [0.5, 0.5];
      if (shape?.frames?.length) {
        const interp = getInterpolatedFrame(shape, frame);
        if (interp?.points?.length) centroidN = centroidUtil(interp.points);
      }

      // Show a temporary marker at the click position
      setPendingNoteScene({
        x: sceneNormalizedCursor[0] * media.width,
        y: sceneNormalizedCursor[1] * media.height,
      });
      onAddNewNote({
        anchorType: "annotation",
        position: {
          x: sceneNormalizedCursor[0] - centroidN[0],
          y: sceneNormalizedCursor[1] - centroidN[1],
          frame,
        },
        annotationId: ann.id,
        screenX: mousePosition[0],
        screenY: mousePosition[1],
      });
      // Exit note tool mode — return to review workspace
      getDriver().setMode("review");
      return;
    }

    // Don't select annotations in creation mode
    if (viewport.isCreationMode) {
      return;
    }

    // Don't select already selected annotation
    if (selection.isAnnotationSelected(ann.id)) return;

    selection.selectAnnotation(ann);
    getDriver().command.call("timeline.scroll_to_annotation");
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
    onclick={onSvgClick}
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
          editable={viewport.mode === EDITOR_MODE &&
            selection.isAnnotationSelected(ann.id) &&
            !annotation.isLocked(ann)}
          cursor={sceneNormalizedCursor}
          mode={viewport.mode}
          onClick={() => handleClick(ann)}
          onEditComplete={(aabb: Point[], angle: number) => handleEditComplete(ann.id, aabb, angle)}
        />
      {/each}

      <!-- Note markers (SVG g — viewBox handles pan/zoom tracking automatically) -->
      {#if viewport.isReviewWorkspace}
        <NoteMarkers />
      {/if}
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
