<script lang="ts">
  // ---------------------------------------------------------------------------
  // ShapesContainer.svelte — SVG overlay + shape rendering for the viewport
  //
  // Replaces the old SvgOverlay + ShapeContainer pair with a single clean
  // component. Responsibilities:
  //   • Wraps <img> inside a <Viewport> (pan/zoom)
  //   • Renders an SVG layer on top with crosshair, build-mode preview, etc.
  //   • Filters visible annotations by current frame and renders them via
  //     AnnotationGeometry
  //   • Handles mouse events for selection, panning, and build-mode creation
  //   • Exposes zoomIn/zoomOut helpers
  // ---------------------------------------------------------------------------

  import { onMount, type Snippet } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import { cn } from "$lib/utils";

  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";
  import AnnotationGeometry from "./AnnotationGeometry.svelte";
  import BBoxCreateShape from "./BBoxCreateShape.svelte";
  import CircleCreateShape from "./CircleCreateShape.svelte";
  import Crosshair from "./Crosshair.svelte";
  import EllipseCreateShape from "./EllipseCreateShape.svelte";
  import LineCreateShape from "./LineCreateShape.svelte";
  import PolygonCreateShape from "./PolygonCreateShape.svelte";
  import NoteMarkers from "$lib/components/App/NoteMarkers.svelte";

  import { viewport } from "$lib/state/viewport.svelte";

  import { magneticSnap } from "$lib/state/magnetic-snap.svelte";
  import { snapEngine } from "$lib/snap-engine/instance";
  import { getDriver } from "$lib/state/driver.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { data, setPendingNoteScene } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { snapDebug } from "$lib/state/ui.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";

  import type { IAnnotationRecord } from "$idah/v2/types";
  import {
    DEFAULT_MODE,
    IMAGE_BOUNDING_BOX,
    IMAGE_CIRCLE,
    IMAGE_ELLIPSE,
    IMAGE_LINE,
    IMAGE_POLYGON,
    NOTE_MODE,
    REVIEW_MODE,
    type IImageAnnotationShape,
    type IImageAnnotationRecord,
  } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import noteIconSvg from "$lib/assets/icons/message-circle.svg?raw";

  // ── Types ──────────────────────────────────────────────────────────────
  export interface OnAddNewNoteParams {
    anchorType: "entry" | "annotation";
    position: Record<string, unknown>;
    annotationId: string | null;
    /** Screen (viewport-fixed) pixel coords for popup placement. */
    screenX?: number;
    screenY?: number;
  }

  type Props = {
    annotations_promise: Promise<IImageAnnotationRecord[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: IImageAnnotationRecord) => void;
    onSelection: (type: string, points?: Point[], extraProps?: Record<string, unknown>, id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    /** A pending annotation (could be missing category) waiting for popover confirmation. */
    pendingAnnotation?: IImageAnnotationRecord;
    /** Category color from the workspace's pendingValue — used for creation previews when category is selected. */
    categoryColor?: string;
  };

  let {
    children,
    onSelection,
    onAddNewNote,
    pendingAnnotation = undefined,
    categoryColor = undefined,
  }: Props = $props();

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

  // ── Magnetic snap state ─────────────────────────────────────────────
  let _snapResult = $state<{ point: Point; kind: string; sourceShapeId?: string } | null>(null);

  /** Resolve the snap indicator color from the source annotation's category, or default to #00FF88. */
  let snapColor = $derived.by((): string => {
    const snap = _snapResult;
    if (!snap?.sourceShapeId) return "#00FF88";
    const src = visibleAnnotations.find((a) => a.id === snap.sourceShapeId);
    if (!src) return "#00FF88";
    return resolveAnnotationColor(src);
  });

  /** Cursor in scene pixel space — used for snap queries (avoids normalized-space aspect-ratio issues). */
  let scenePixelCursor: Point = $derived.by((): Point => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [sv.x, sv.y];
  });

  /** Cursor after snap correction (in normalized space for creation shapes). */
  let snappedCursor: Point = $derived.by((): Point => {
    if (magneticSnap.enabled && _snapResult) {
      // Convert snapped pixel-space point back to normalized
      return [
        media.width > 0 ? _snapResult.point[0] / media.width : 0,
        media.height > 0 ? _snapResult.point[1] / media.height : 0,
      ];
    }
    return sceneNormalizedCursor;
  });

  /** Threshold in scene pixels: ~10 screen pixels adjusted for zoom. */
  let snapThreshold = $derived(
    viewport.workspace.transform.scale > 0
      ? 10 / viewport.workspace.transform.scale
      : 10,
  );

  // ── Viewport ref ──────────────────────────────────────────────────────
  let zoomableElement = $state<Viewport | undefined>(undefined);

  // ── Component API registry for tool selection ─────────────────────────
  // Children self-register their API here, keyed by annotation id. We avoid
  // `bind:this={_compRefs[i]}` in the {#each}: its teardowns chain onto this
  // component's root effect, so destroying N annotations at once overflows the
  // stack (RangeError). Self-registration tears down flat. Only the selected
  // annotation's API is ever read, so a map by id fits better than an array.
  type AnnotationApi = {
    getToolSelection: () => { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined;
    getIsEditing: () => boolean;
  };
  const compApis = new SvelteMap<string, AnnotationApi>();

  function registerAnnotationApi(id: string, api: AnnotationApi | null) {
    if (api) compApis.set(id, api);
    else compApis.delete(id);
  }

  // Build a flat list of visible annotations (filtered by current frame and hidden state).
  // The list is ordered so the selected annotation always comes last (highest z-order
  // in SVG), and non-selected annotations are ordered by creation (earliest first).
  // This ensures overlapping shapes always have the selected one on top.
  //
  // Performance note: a single O(n) pass filters visibility and partitions the
  // selected annotation. Each created_at is parsed exactly once here (decorate),
  // so the sort compares precomputed numbers instead of calling Date.parse
  // O(n log n) times — this recompute runs on every annotation batch during a
  // large streaming load, so the difference compounds.
  let visibleAnnotations = $derived.by<IAnnotationRecord[]>(() => {
    const items = data.annotations?.items ?? [];

    const selected: IAnnotationRecord[] = [];
    const rest: { ann: IAnnotationRecord; t: number }[] = [];
    for (const ann of items) {
      // Skip hidden annotations
      if (annotation.isHidden(ann)) continue;
      // Separate selected annotation (goes at end for z-order) from the rest,
      // decorating the rest with a parsed creation timestamp for sorting.
      if (selection.isAnnotationSelected(ann.id)) {
        selected.push(ann);
      } else {
        rest.push({ ann, t: ann.created_at ? Date.parse(ann.created_at as string) : 0 });
      }
    }

    // Sort non-selected by creation order (earliest first) for stable z-ordering.
    // The selected annotation is appended unsorted — only one, so no sort needed.
    rest.sort((a, b) => a.t - b.t);

    return [...rest.map((r) => r.ann), ...selected];
  });

  // Derive tool selection from the currently selected annotation's component
  let selAnnotation = $derived(selection.value);

  let toolSelection = $derived.by(() => {
    const selId = selection.value?.id ?? null;
    if (!selId) return undefined;
    return compApis.get(selId)?.getToolSelection();
  });

  // ── Create shape component refs ───────────────────────────────────────
  let bboxCreateComp: BBoxCreateShape | undefined = $state(undefined);
  let circleCreateComp: CircleCreateShape | undefined = $state(undefined);
  let ellipseCreateComp: EllipseCreateShape | undefined = $state(undefined);
  let lineCreateComp: LineCreateShape | undefined = $state(undefined);
  let polygonCreateComp: PolygonCreateShape | undefined = $state(undefined);

  let isBoundingBoxMode = $derived(viewport.mode === IMAGE_BOUNDING_BOX);
  let isCircleMode = $derived(viewport.mode === IMAGE_CIRCLE);
  let isEllipseMode = $derived(viewport.mode === IMAGE_ELLIPSE);
  let isLineMode = $derived(viewport.mode === IMAGE_LINE);
  let isPolygonMode = $derived(viewport.mode === IMAGE_POLYGON);
  let isNoteMode = $derived(viewport.mode === NOTE_MODE);

  /** Preview color for create-shape overlays — uses categoryColor (from toolbar or pendingValue) or falls back to pendingAnnotation's category. */
  let previewColor = $derived.by<string | undefined>(() => {
    if (categoryColor) return categoryColor;
    if (!pendingAnnotation) return undefined;
    return resolveAnnotationColor(pendingAnnotation);
  });

  // ── Panning state ────────────────────────────────────────────────────
  let isPanning = $state(false);
  let isDragging = $state(false);

  /** Whether the user is actively dragging/resizing/rotating a shape handle — derived from the selected annotation's component. */
  let isEditingShape = $derived.by((): boolean => {
    const selId = selection.value?.id ?? null;
    if (!selId) return false;
    return compApis.get(selId)?.getIsEditing?.() ?? false;
  });

  // ── Update snap engine targets when visible annotations change ──
  $effect(() => {
    const anns = visibleAnnotations;
    const snapOn = magneticSnap.enabled;

    snapDebug.enabled = snapOn;
    snapDebug.targetCount = anns.length;

    if (!snapOn) {
      _snapResult = null;
      snapDebug.snapped = null;
      snapDebug.kind = null;
      return;
    }

    snapEngine.setTargets(
      anns.map((ann) => ({
        id: ann.id,
        kind: (ann.shape as Record<string, unknown>)?.type as string ?? "",
        data: ann.shape,
      })),
      media.width,
      media.height,
    );
  });

  onMount(() => {
    viewport.svgElement = svgEl ?? null;

    // Add a tiny stylesheet for cursor classes
    const style = document.createElement("style");
    const cursorSvg = encodeURIComponent(noteIconSvg.replace('fill="none"', 'fill="white"'));
    style.textContent = `
      .cursor-note { cursor: url('data:image/svg+xml;charset=utf-8,${cursorSvg}') 0 24, auto; }
      .cursor-crosshair { cursor: crosshair; }
      .cursor-grab { cursor: grab; }
      /* !important so an active grab also beats the shapes' inline style:cursor */
      .cursor-grabbing, .cursor-grabbing * { cursor: grabbing !important; }
      .cursor-pointer { cursor: pointer; }
      .cursor-target { cursor: alias; }
    `;
    document.head.appendChild(style);

    return () => {
      viewport.svgElement = null;
      document.head.removeChild(style);
    };
  });

  // ── Exported zoom helpers ────────────────────────────────────────────
  export function zoomIn() {
    zoomableElement!.zoomIn();
  }
  export function zoomOut() {
    zoomableElement!.zoomOut();
  }

  // ── Check if cursor is hovering the first polygon draft point ────────
  let hoveringFirstPoint = $derived(
    isPolygonMode &&
      nearFirstPolygonPoint(
        snappedCursor,
        media.width,
        media.height,
        polygonDraft.points,
        viewport.workspace.transform.scale,
      ),
  );

  // ── Cursor class ─────────────────────────────────────────────────────
  let pointer = $derived.by(() => {
    // An active grab (middle-mouse or drag pan) outranks every other cursor.
    if (isPanning) return "cursor-grabbing";
    if (hoveringFirstPoint) return "cursor-target";
    if (viewport.isCreationMode) return "cursor-crosshair";
    if (isNoteMode) return "cursor-note";
    if (selAnnotation) return "cursor-pointer";

    return "cursor-grab";
  });

  let showCrosshair = $derived(screenDimensions[0] > 0 && screenDimensions[1] > 0 && viewport.isCreationMode);

  const viewBox = $derived.by(() => {
    const [tx, ty] = viewport.workspace.transform.translate;
    const [w, h] = viewport.workspace.dimensions;
    const s = viewport.workspace.transform.scale;
    return `${-tx / s} ${-ty / s} ${w / s} ${h / s}`;
  });

  // ── Event handlers ───────────────────────────────────────────────────
  function onMouseMove(e: MouseEvent) {
    mousePosition = [e.offsetX, e.offsetY];

    // ── Magnetic snap query ────────────────────────────────────────
    // Only snap while creating a shape OR actively editing (dragging/resizing) an existing shape.
    // Don't snap when merely hovering a selected annotation — the preview dots would
    // obscure the cursor and make it hard to see you can drag.
    if (magneticSnap.enabled && (viewport.isCreationMode || isEditingShape)) {
      const excludeShapeId: string | undefined = selAnnotation?.id;

      const result = snapEngine.querySnap(scenePixelCursor, {
        threshold: snapThreshold,
        excludeShapeId,
      });
      _snapResult = result;

      // Update debug info
      snapDebug.cursor = scenePixelCursor;
      snapDebug.threshold = snapThreshold;
      snapDebug.snapped = result?.point ?? null;
      snapDebug.kind = result?.kind ?? null;
      snapDebug.candidates = result ? 1 : 0;
    } else {
      _snapResult = null;
      snapDebug.snapped = null;
      snapDebug.kind = null;
      snapDebug.candidates = 0;
    }

    // Only pan in default mode
    if (viewport.mode === DEFAULT_MODE) {
      zoomableElement!.mouseMove(e);
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoomableElement!.onWheel(e);
  }

  // Middle-mouse-button grab: pan the viewport from anywhere, even when the
  // cursor is over an annotation. Shape handlers stopPropagation on the bubble
  // phase, so this runs in the capture phase to get in first. Once started, the
  // Viewport's own document-level listeners carry the drag to completion.
  function onMouseDownCapture(e: MouseEvent) {
    if (e.button !== 1) return;
    e.preventDefault(); // suppress the browser's middle-click autoscroll
    e.stopPropagation(); // keep shape/selection handlers from reacting
    zoomableElement!.startPan(e.clientX, e.clientY);
  }

  function onMouseDown(e: MouseEvent) {
    // Sync mousePosition so the cursor prop used by shape components
    // reflects the actual click position (not the last mousemove).
    mousePosition = [e.offsetX, e.offsetY];

    // ── Polygon creation mode — delegate to PolygonCreateShape ─────
    if (isPolygonMode) {
      e.stopPropagation();
      polygonCreateComp?.handleMouseDown(snappedCursor);
      return;
    }

    // ── Bounding-box creation mode — delegate to BBoxCreateShape ───
    if (isBoundingBoxMode) {
      bboxCreateComp?.handleMouseDown(snappedCursor);
      return;
    }

    // ── Circle creation mode — delegate to CircleCreateShape ─────
    if (isCircleMode) {
      circleCreateComp?.handleMouseDown(snappedCursor);
      return;
    }

    // ── Ellipse creation mode — delegate to EllipseCreateShape ───
    if (isEllipseMode) {
      ellipseCreateComp?.handleMouseDown(snappedCursor);
      return;
    }

    // ── Line creation mode — delegate to LineCreateShape ─────────
    if (isLineMode) {
      lineCreateComp?.handleMouseDown(snappedCursor);
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
    zoomableElement!.mouseDown(e);
  }

  function onMouseLeave(_e: MouseEvent) {
    // Cancel any active tool edit (bounding box drag, resize, rotate)
    toolSelection?.endSelection(sceneNormalizedCursor);
    // Stop viewport panning
    zoomableElement!.mouseUp(new MouseEvent("mouseup"));
  }

  function onMouseUp(e: MouseEvent) {
    // ── Bounding-box creation mode — finalize on BBoxCreateShape ──
    if (isBoundingBoxMode) {
      bboxCreateComp?.handleMouseUp(snappedCursor);
      return;
    }

    // ── Circle creation mode — finalize on CircleCreateShape ────
    if (isCircleMode) {
      circleCreateComp?.handleMouseUp(snappedCursor);
      return;
    }

    // ── Ellipse creation mode — finalize on EllipseCreateShape ──
    if (isEllipseMode) {
      ellipseCreateComp?.handleMouseUp(snappedCursor);
      return;
    }

    // Note mode is handled in onSvgClick — defer to click event
    if (isNoteMode) {
      return;
    }

    // Default mode: finalize edit operation
    toolSelection?.endSelection(sceneNormalizedCursor);

    // Only pan on mouseup if we were panning
    zoomableElement!.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IAnnotationRecord) {
    const rect = viewport.svgElement!.getBoundingClientRect();
    const screenX = rect.left + mousePosition[0];
    const screenY = rect.top + mousePosition[1];

    if (!annotation) {
      // Entry note: position is normalized scene coordinates (fixed point in image)
      setPendingNoteScene({
        type: "entry",
        x: sceneNormalizedCursor[0],
        y: sceneNormalizedCursor[1],
      });
      onAddNewNote({
        anchorType: "entry",
        position: {
          x: sceneNormalizedCursor[0],
          y: sceneNormalizedCursor[1],
        },
        annotationId: null,
        screenX,
        screenY,
      });
    } else {
      // Annotation note: position is normalized offset from annotation centroid,
      // so the note tracks the annotation when it moves.
      const shape = annotation.shape as IImageAnnotationShape | undefined;
      let centroidN: [number, number] = [0.5, 0.5];
      if (shape?.points?.length) {
        const pts = shape.points;
        centroidN = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      }
      const offsetX = sceneNormalizedCursor[0] - centroidN[0];
      const offsetY = sceneNormalizedCursor[1] - centroidN[1];
      setPendingNoteScene({
        type: "annotation",
        annotationId: annotation.id,
        x: offsetX,
        y: offsetY,
      });
      onAddNewNote({
        anchorType: "annotation",
        position: {
          x: offsetX,
          y: offsetY,
        },
        annotationId: annotation.id,
        screenX,
        screenY,
      });
    }
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

  function handleEditComplete(annId: string, points: Point[], extraProps: Record<string, unknown> = {}) {
    onSelection(viewport.mode, points, extraProps, annId);
  }

  let _noteHandledByClick = $state(false);

  function handleClick(ann: IAnnotationRecord) {
    // Note mode: create an annotation-anchored note
    if (isNoteMode) {
      _noteHandledByClick = true;
      showNewNoteFeedPopup(ann as IImageAnnotationRecord);
      return;
    }

    // Don't select annotations in creation mode
    if (viewport.isCreationMode) return;

    // Don't select already selected annotation
    if (selection.isAnnotationSelected(ann.id)) return;

    selection.selectAnnotation(ann);
  }
</script>

<div class={cn("shapes-container flex-1", pointer)}>
  <!-- Layer 0: Viewport with image content -->
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
    onmousedowncapture={onMouseDownCapture}
    onmousedown={onMouseDown}
    onmouseup={onMouseUp}
    onmousemove={onMouseMove}
    onmouseleave={onMouseLeave}
    onwheel={onWheel}
    onclick={onSvgClick}
  >
    <!-- Crosshair (for build modes) -->
    <Crosshair cursor={sceneMousePosition} visible={showCrosshair} />

    <!-- Rendered annotations -->
    {#each visibleAnnotations as ann (ann.id)}
      <AnnotationGeometry
        register={registerAnnotationApi}
        annotation={ann}
        selected={selection.isAnnotationSelected(ann.id)}
        editable={viewport.mode === DEFAULT_MODE &&
          selection.isAnnotationSelected(ann.id) &&
          !annotation.isLocked(ann) &&
          !["errored", "completed"].includes(getDriver().entryStatus)}
        cursor={snappedCursor}
        mode={viewport.mode}
        onClick={() => handleClick(ann)}
        onEditComplete={(aabb: Point[], extraProps: Record<string, unknown> = {}) =>
          handleEditComplete(ann.id, aabb, extraProps)}
      />
    {/each}

    <!-- Magnetic snap visual feedback (handler-style dot + ring) -->
    {#if magneticSnap.enabled && _snapResult}
      {@const snapPx = _snapResult.point}
      {@const invScale = 1 / viewport.workspace.transform.scale}
      <!-- Outer ring -->
      <circle
        cx={snapPx[0]}
        cy={snapPx[1]}
        r={8 * invScale}
        fill="none"
        stroke={snapColor}
        stroke-width={2}
        opacity="0.8"
        vector-effect="non-scaling-stroke"
      />
      <!-- Inner dot -->
      <circle
        cx={snapPx[0]}
        cy={snapPx[1]}
        r={4 * invScale}
        fill={snapColor}
        opacity="0.9"
        vector-effect="non-scaling-stroke"
      />
    {/if}

    <g>
      <!-- Build mode: bounding box creation preview -->
      {#if isBoundingBoxMode && !pendingAnnotation}
        <BBoxCreateShape
          bind:this={bboxCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {onSelection}
          color={previewColor}
        />
      {/if}

      <!-- Build mode: circle creation preview -->
      {#if isCircleMode && !pendingAnnotation}
        <CircleCreateShape
          bind:this={circleCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {onSelection}
          color={previewColor}
        />
      {/if}

      <!-- Build mode: ellipse creation preview -->
      {#if isEllipseMode && !pendingAnnotation}
        <EllipseCreateShape
          bind:this={ellipseCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {onSelection}
          color={previewColor}
        />
      {/if}

      <!-- Build mode: line creation preview -->
      {#if isLineMode && !pendingAnnotation}
        <LineCreateShape
          bind:this={lineCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {onSelection}
          color={previewColor}
        />
      {/if}

      <!-- Build mode: polygon creation preview -->
      {#if isPolygonMode && !pendingAnnotation}
        <PolygonCreateShape
          bind:this={polygonCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          {onSelection}
          color={previewColor}
        />
      {/if}

      <!-- Pending annotation (waiting for category in popover) -->
      {#if pendingAnnotation}
        <AnnotationGeometry
          annotation={pendingAnnotation}
          selected={false}
          editable={false}
          cursor={snappedCursor}
          mode={viewport.mode}
        />
      {/if}

      <!-- Note markers (shown in review workspace) -->
      {#if viewport.mode === REVIEW_MODE || viewport.mode === NOTE_MODE}
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
