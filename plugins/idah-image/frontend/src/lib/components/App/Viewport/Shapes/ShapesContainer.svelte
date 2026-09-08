<script lang="ts">
  // ---------------------------------------------------------------------------
  // ShapesContainer.svelte — SVG overlay + shape rendering for the viewport
  //
  // Replaces the old SvgOverlay + ShapeContainer pair with a single clean
  // component. Responsibilities:
  //   • Wraps <img> inside a <Viewport> (pan/zoom)
  //   • Renders an SVG layer on top with crosshair, build-mode preview, etc.
  //   • Filters visible annotations and renders them via AnnotationGeometry
  //   • Handles mouse events for selection, panning, and build-mode creation
  //   • Supports multi-selection: Shift+Click toggle, Shift+Drag rectangle selection
  //     (Alt key is used for vertex deletion and box selection in polygon editing)
  //   • Exposes zoomIn/zoomOut helpers
  // ---------------------------------------------------------------------------

  import { onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";
  import AnnotationGeometry from "./AnnotationGeometry.svelte";
  import AnnotationLabels from "./AnnotationLabels.svelte";
  import BBoxCreateShape from "./BBoxCreateShape.svelte";
  import CircleCreateShape from "./CircleCreateShape.svelte";
  import Crosshair from "./Crosshair.svelte";
  import EllipseCreateShape from "./EllipseCreateShape.svelte";
  import LineCreateShape from "./LineCreateShape.svelte";
  import PolygonCreateShape from "./PolygonCreateShape.svelte";
  import MaskPolygonCreateShape from "./MaskPolygonCreateShape.svelte";
  import MaskCanvasLayer from "./MaskCanvasLayer.svelte";
  import NoteMarkers from "$lib/components/App/NoteMarkers.svelte";

  import { viewport } from "$lib/state/viewport.svelte";

  import { magneticSnap } from "$lib/state/magnetic-snap.svelte";
  import { snapEngine } from "$lib/snap-engine/instance";
  import { getDriver } from "$lib/state/driver.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { data, setPendingNoteScene, type AnnotationItem } from "$lib/state/data.svelte";
  import { maskSession } from "$lib/state/mask-session.svelte";
  import { maskTool } from "$lib/state/mask-tool.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { snapDebug } from "$lib/state/ui.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";

  import {
    onPointerDown as maskBrushPointerDown,
    onPointerMove as maskBrushPointerMove,
    onPointerUp as maskBrushPointerUp,
    onCancel as maskBrushCancel,
  } from "$lib/commands/mode/mask_brush";
  import { hitTestMaskLayer } from "$lib/mask/hit-test";
  import { maskPolygonDraft } from "$lib/commands/mode/mask_polygon";

  import type { IAnnotationRecord } from "$idah/v2/types";
  import {
    DEFAULT_MODE,
    IMAGE_BOUNDING_BOX,
    IMAGE_CIRCLE,
    IMAGE_ELLIPSE,
    IMAGE_LINE,
    IMAGE_POLYGON,
    IMAGE_MASK,
    NOTE_MODE,
    REVIEW_MODE,
    NON_DRAWABLE_SHAPE_TYPES,
    type IImageAnnotationShape,
    type IImageAnnotationRecord,
  } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { centroid as centroidUtil } from "$lib/utils/math/point";
  import { rotatePointN } from "./BoundingBox/utils";
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
    const frame = viewport.image.currentFrame.value;
    const items = data.annotations?.items ?? [];

    // Single-pass: filter visible annotations while partitioning selected vs rest
    const { rest, selected } = items.reduce<{
      rest: IAnnotationRecord[];
      selected: IAnnotationRecord[];
    }>(
      (acc, ann) => {
        // Skip hidden annotations
        if (annotation.isHidden(ann)) return acc;
        // Skip non-drawable records (entry:root) — they are never rendered on
        // canvasand are only edited through the Tagging tab.
        if (NON_DRAWABLE_SHAPE_TYPES.has((ann.shape as { type?: string })?.type ?? "")) return acc;
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
  // let selAnnotation = $derived(selection.value);
  // Derive tool selection from the primary (first) selected annotation's component
  // In multi-selection mode, only the primary annotation gets edit handles.
  let selAnnotation = $derived.by((): IAnnotationRecord | undefined => {
    // if (!selection.isAnnotation()) return undefined;
    const anns = selection.selectedAnnotations;
    return anns.length > 0 ? anns[0] : undefined;
  });

  let toolSelection = $derived.by(() => {
  if (!selAnnotation) return undefined;

  const idx = visibleAnnotations.findIndex((a) => a.id === selAnnotation.id);
  if (idx === -1) return undefined;
    return _compRefs[idx]?.getToolSelection();
  });

  // ── Create shape component refs ───────────────────────────────────────
  let bboxCreateComp: BBoxCreateShape | undefined = $state(undefined);
  let circleCreateComp: CircleCreateShape | undefined = $state(undefined);
  let ellipseCreateComp: EllipseCreateShape | undefined = $state(undefined);
  let lineCreateComp: LineCreateShape | undefined = $state(undefined);
  let polygonCreateComp: PolygonCreateShape | undefined = $state(undefined);
  let maskPolygonCreateComp: MaskPolygonCreateShape | undefined = $state(undefined);

  let isBoundingBoxMode = $derived(viewport.mode === IMAGE_BOUNDING_BOX);
  let isCircleMode = $derived(viewport.mode === IMAGE_CIRCLE);
  let isEllipseMode = $derived(viewport.mode === IMAGE_ELLIPSE);
  let isLineMode = $derived(viewport.mode === IMAGE_LINE);
  let isPolygonMode = $derived(viewport.mode === IMAGE_POLYGON);
  let isNoteMode = $derived(viewport.mode === NOTE_MODE);
  let isMaskBrushMode = $derived(viewport.mode === IMAGE_MASK && maskTool.active === "brush");
  let isMaskPolygonMode = $derived(viewport.mode === IMAGE_MASK && maskTool.active === "polygon");

  /** Preview color for create-shape overlays — uses categoryColor (from toolbar or pendingValue) or falls back to pendingAnnotation's category. */
  let previewColor = $derived.by<string | undefined>(() => {
    if (categoryColor) return categoryColor;
    if (!pendingAnnotation) return undefined;
    return resolveAnnotationColor(pendingAnnotation);
  });

  // ── Rectangle selection state ─────────────────────────────────────────
  let isRectSelecting = $state(false);
  let rectStart: Point | null = $state(null);
  let rectEnd: Point | null = $state(null);

  /** Screen-pixel movement below which a press-and-release still counts as a click, not a drag. */
  const DRAG_SLOP_PX = 4;

  /**
   * Client position of the most recent mousedown, recorded in the capture phase
   * so it is captured even for presses a shape stops on the bubble phase. Comparing
   * against it tells a real click apart from the click that trails every drag —
   * no flag to set, so nothing can go stale between gestures.
   */
  let _mouseDownClient: Point | null = null;

  /** Whether the pointer moved past the slop between the last mousedown and this event. */
  function movedSinceMouseDown(e: MouseEvent): boolean {
    if (!_mouseDownClient) return false;
    return (
      Math.abs(e.clientX - _mouseDownClient[0]) > DRAG_SLOP_PX ||
      Math.abs(e.clientY - _mouseDownClient[1]) > DRAG_SLOP_PX
    );
  }

  /** Whether the current Shift+Drag moved far enough to be a rectangle selection rather than a click. */
  function rectSelectionIsDrag(): boolean {
    if (!rectStart || !rectEnd) return false;
    const scale = viewport.workspace.transform.scale || 1;
    const dx = Math.abs(rectEnd[0] - rectStart[0]) * media.width * scale;
    const dy = Math.abs(rectEnd[1] - rectStart[1]) * media.height * scale;
    return dx > DRAG_SLOP_PX || dy > DRAG_SLOP_PX;
  }

  /** Clear rectangle-selection state without touching the current selection. */
  function cancelRectSelection() {
    isRectSelecting = false;
    rectStart = null;
    rectEnd = null;
  }

  /** Finalize a rectangle selection: a real drag commits it, a click-sized one is discarded. */
  function finishRectSelection() {
    if (!isRectSelecting) return;
    if (rectSelectionIsDrag()) completeRectSelection();
    else cancelRectSelection();
  }

  /**
   * The region currently on screen, in normalized media coords: [minX, minY, maxX, maxY].
   * Mirrors the SVG viewBox — scene origin is -translate/scale, extent is dimensions/scale.
   */
  let visibleBoundsN = $derived.by((): [number, number, number, number] => {
    const [tx, ty] = viewport.workspace.transform.translate;
    const [w, h] = viewport.workspace.dimensions;
    const sc = viewport.workspace.transform.scale || 1;
    const mw = media.width || 1;
    const mh = media.height || 1;
    return [-tx / sc / mw, -ty / sc / mh, (-tx + w) / sc / mw, (-ty + h) / sc / mh];
  });

  /**
   * Normalized selection rectangle: [minX, minY, maxX, maxY].
   *
   * Clamped to the visible region: the drag keeps tracking outside the SVG (so
   * crossing the edge doesn't strand the gesture), but the rectangle itself must
   * not reach content the user cannot see and did not knowingly sweep over.
   * Clamping here covers both the drawn overlay and completeRectSelection, so the
   * box the user sees is exactly the box that selects.
   */
  let selectionRect = $derived.by((): [number, number, number, number] | null => {
    if (!isRectSelecting || !rectStart || !rectEnd || !rectSelectionIsDrag()) return null;
    const [vx0, vy0, vx1, vy1] = visibleBoundsN;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    return [
      clamp(Math.min(rectStart[0], rectEnd[0]), vx0, vx1),
      clamp(Math.min(rectStart[1], rectEnd[1]), vy0, vy1),
      clamp(Math.max(rectStart[0], rectEnd[0]), vx0, vx1),
      clamp(Math.max(rectStart[1], rectEnd[1]), vy0, vy1),
    ];
  });

  // ── Multi-drag state (Feature 2 — Move Selected Shapes) ────────────────
  /** Normalized cursor position when the multi-drag started. */
  let _multiDragOrigin: Point | null = $state(null);
  /** Current shared drag delta in normalized coords. */
  let _multiDragDelta: Point | null = $state(null);
  /**
   * Batch accumulator for multi-shape drag.
   * When non-null, `handleEditComplete` collects updates here instead of
   * dispatching individual commands. At the end of `onMouseUp` the entire
   * batch is dispatched as a single undoable command, so one Ctrl+Z restores
   * ALL moved shapes to their original positions.
   */
  let _commitBatch: Array<{
    annotationId: string;
    shape: IImageAnnotationShape;
    /** Pre-move snapshot captured BEFORE the synchronous upsert runs. */
    snapshot: AnnotationItem;
  }> | null = null;

  /** Whether any selected annotation component is currently being edited (dragged). */
  let _anySelectedEditing = $derived.by((): boolean => {
    for (let i = 0; i < visibleAnnotations.length; i++) {
      if (selection.isAnnotationSelected(visibleAnnotations[i].id) && _compRefs[i]?.getIsEditing?.()) {
        return true;
      }
    }
    return false;
  });

  // ── Panning state ────────────────────────────────────────────────────
  let isPanning = $state(false);
  let isDragging = $state(false);

  /** Whether the user is actively dragging/resizing/rotating a shape handle — derived from the primary selected annotation's component. */
  let isEditingShape = $derived.by((): boolean => {
    if (!selAnnotation) return false;
    const idx = visibleAnnotations.findIndex((a) => a.id === selAnnotation.id);
    if (idx === -1) return false;
    return _compRefs[idx]?.getIsEditing?.() ?? false;
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
      /* Applied to <body> while a viewport gesture is live: a drag that leaves the
         SVG would otherwise start a native text selection across the sidebars it
         passes over. */
      .idah-image-dragging, .idah-image-dragging * { user-select: none !important; -webkit-user-select: none !important; }
    `;
    document.head.appendChild(style);

    return () => {
      viewport.svgElement = null;
      document.head.removeChild(style);
      endGestureTracking();
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
    (isPolygonMode &&
      nearFirstPolygonPoint(
        snappedCursor,
        media.width,
        media.height,
        polygonDraft.points,
        viewport.workspace.transform.scale,
      )) ||
    (isMaskPolygonMode &&
      nearFirstPolygonPoint(
        snappedCursor,
        media.width,
        media.height,
        maskPolygonDraft.points,
        viewport.workspace.transform.scale,
      )),
  );

  // ── Cursor class ─────────────────────────────────────────────────────
  let pointer = $derived.by(() => {
    // An active grab (middle-mouse or drag pan) outranks every other cursor.
    if (isPanning) return "cursor-grabbing";
    if (hoveringFirstPoint) return "cursor-target";
    if (viewport.isCreationMode) return "cursor-crosshair";
    if (isNoteMode) return "cursor-note";
    if (selAnnotation) return "cursor-pointer";
    if (_hoveringMask) return "cursor-pointer";

    return "cursor-grab";
  });

  let showCrosshair = $derived(screenDimensions[0] > 0 && screenDimensions[1] > 0 && viewport.isCreationMode);

  const viewBox = $derived.by(() => {
    const [tx, ty] = viewport.workspace.transform.translate;
    const [w, h] = viewport.workspace.dimensions;
    const s = viewport.workspace.transform.scale;
    return `${-tx / s} ${-ty / s} ${w / s} ${h / s}`;
  });

  // ── Rectangle selection helpers ────────────────────────────────────────

  /** Compute the AABB of an annotation's shape. Returns null if no geometry. */
  function getAnnotationAABB(ann: IAnnotationRecord): [number, number, number, number] | null {
    const shape = (ann.shape ?? {}) as IImageAnnotationShape | undefined;
    if (!shape?.points?.length) return null;

    // `points` holds the unrotated corners — `angle` is applied as a render
    // transform around the centroid (see BBoxShape's transform-origin), so the
    // box must be rotated the same way here. Otherwise a rotated annotation is
    // hit-tested against the bounds it would occupy at 0°, which is not where
    // the user sees it. rotatePointN does the math in pixel space, matching the
    // render; shapes with no angle skip this untouched.
    const angle = (shape.angle as number | undefined) ?? 0;
    let pts = shape.points as Point[];
    if (angle !== 0 && media.width > 0 && media.height > 0) {
      const center = centroidUtil(pts);
      pts = pts.map((pt) => rotatePointN(pt, center, angle, media.width, media.height));
    }

    const xs = pts.map((pt) => pt[0]);
    const ys = pts.map((pt) => pt[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  /** Check if two AABBs intersect. */
  function aabbIntersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  }

  /** Complete the rectangle selection, selecting all visible annotations intersecting the rect. */
  function completeRectSelection() {
    const rect = selectionRect;
    if (!rect) return;

    const intersectingIds = visibleAnnotations
      .filter((ann) => {
        const aabb = getAnnotationAABB(ann);
        if (!aabb) return false;
        return aabbIntersects(aabb, rect);
      })
      .map((ann) => ann.id);

    selection.selectAnnotations(intersectingIds);
    cancelRectSelection();
  }

  // ── Event handlers ───────────────────────────────────────────────────
  /**
   * Hit-test the mask canvas layer at the given image-pixel coordinates.
   * Checks all committed mask annotations for a painted pixel at (imgX, imgY).
   * Returns the first mask annotation that has a painted pixel at this position.
   *
   * Uses the canonical implementation from hit-test.ts which sources tile buffers
   * from the shared decode cache rather than decoding RLE inline.
   */
  function resolveColorForAnnotation(ann: { id: string; value?: Record<string, unknown> }): [number, number, number, number] {
    // Default color — callers can override via the driver config
    return [255, 0, 0, 100];
  }

  // ── Document-level gesture tracking ──────────────────────────────────
  // A press that starts on the SVG must keep tracking after the cursor leaves it,
  // and must finalize wherever it is released. Without this, crossing the viewport
  // edge mid-drag stranded the gesture: the batch commit for a multi-selection
  // lives in onMouseUp, which never fires for a release outside the SVG, so only
  // the shape that was under the cursor kept its new position.
  // Viewport does the same for panning (see panStart there).
  function beginGestureTracking() {
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    document.body.classList.add("idah-image-dragging");
  }

  function endGestureTracking() {
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
    document.body.classList.remove("idah-image-dragging");
  }

  function onDocMouseMove(e: MouseEvent) {
    // Recovery: no buttons held means the release happened somewhere we never
    // saw it (released over another window, say). Finalize rather than leave the
    // gesture — and the body's user-select lock — hanging.
    if (e.buttons === 0) {
      onDocMouseUp(e);
      return;
    }

    // Moves over the SVG are already served by its own handler — this only
    // extends a gesture that has wandered outside it.
    if (!svgEl || (e.target instanceof Node && svgEl.contains(e.target))) return;
    const rect = svgEl.getBoundingClientRect();
    handlePointerMove(e, [e.clientX - rect.left, e.clientY - rect.top], true);
  }

  function onDocMouseUp(e: MouseEvent) {
    endGestureTracking();
    onMouseUp(e);
  }

  function onMouseMove(e: MouseEvent) {
    handlePointerMove(e, [e.offsetX, e.offsetY], false);
  }

  function handlePointerMove(e: MouseEvent, position: Point, fromDocument: boolean) {
    mousePosition = position;

    // ── Mask brush painting (no early return — let viewport tracking below proceed) ─
    if (isMaskBrushMode) {
      maskBrushPointerMove(scenePixelCursor[0], scenePixelCursor[1]);
    }

    // Track the last known cursor position in normalized coords so commands
    // (e.g. selection.paste) can target where the user's cursor currently is.
    // This is a plain $state write in a regular function — it does NOT create
    // a reactive cycle. viewport.cursor is only read by the async paste command.
    viewport.cursor = [sceneNormalizedCursor[0], sceneNormalizedCursor[1]];

    // ── Rectangle selection tracking ───────────────────────────────
    if (isRectSelecting) {
      rectEnd = sceneNormalizedCursor;
      return;
    }

    // ── Multi-drag: track shared delta for batch move ─────────────────
    // When multiple annotations are selected and one is being dragged,
    // compute the delta and pass it to all selected shapes so they move
    // together visually.
    if (selection.selectedAnnotations.length > 1 && _anySelectedEditing) {
      if (!_multiDragOrigin) {
        _multiDragOrigin = [sceneNormalizedCursor[0], sceneNormalizedCursor[1]];
      }
      _multiDragDelta = [
        sceneNormalizedCursor[0] - _multiDragOrigin[0],
        sceneNormalizedCursor[1] - _multiDragOrigin[1],
      ];
    }

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

    // Check if hovering over a mask pixel — update cursor accordingly (throttled via RAF)
    if (viewport.mode === DEFAULT_MODE) {
      scheduleHoverHitTest();
    }

    // Only pan in default mode. Never forward a document-sourced event: its
    // offsetX/offsetY are relative to whatever element happens to be under the
    // cursor, and Viewport installs its own document listeners once a pan starts.
    if (!fromDocument && viewport.mode === DEFAULT_MODE) {
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
    _mouseDownClient = [e.clientX, e.clientY];
    // Capture phase: runs even for presses a shape stops on bubble, so every
    // gesture that starts here is tracked to its release, wherever that lands.
    // Middle-click is excluded: onMouseUpCapture stops that release in the
    // capture phase, so a document mouseup would never arrive to untrack it —
    // and Viewport already carries middle-button pans on its own listeners.
    if (e.button !== 1) beginGestureTracking();

    // Anchor a potential group drag at the press point. The dragged shape records
    // its own start here too (its mousedown runs next, in the bubble phase), so
    // letting the first mousemove set the origin instead leaves the rest of the
    // selection permanently short by that first movement — they lag behind the
    // shape under the cursor and commit in the wrong place.
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      mousePosition = [e.clientX - rect.left, e.clientY - rect.top];
      _multiDragOrigin = [sceneNormalizedCursor[0], sceneNormalizedCursor[1]];
    }

    if (e.button !== 1) return;
    e.preventDefault(); // suppress the browser's middle-click autoscroll
    e.stopPropagation(); // keep shape/selection handlers from reacting
    zoomableElement!.startPan(e.clientX, e.clientY);
  }
  function onMouseUpCapture(e: MouseEvent) {
    if (e.button !== 1) return;
    e.preventDefault(); // suppress the browser's middle-click autoscroll
    e.stopPropagation(); // keep shape/selection handlers from reacting
    zoomableElement!.mouseUp(e);
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

    // ── Mask brush mode — start painting ────────────────────────────
    if (isMaskBrushMode) {
      e.preventDefault();
      e.stopPropagation();
      // If the selected annotation is a locked mask, refuse to paint at all
      // (no new mask, no edit) — mirroring the vector-shape lock guard.
      const isLockedSelectedMask =
        selAnnotation?.shape?.type === IMAGE_MASK && annotation.isLocked(selAnnotation);
      if (isLockedSelectedMask) return;
      const maskAnnId = selAnnotation?.shape?.type === IMAGE_MASK ? selAnnotation.id : undefined;
      maskBrushPointerDown(scenePixelCursor[0], scenePixelCursor[1], maskAnnId);
      return;
    }

    // ── Mask polygon mode — delegate to PolygonCreateShape (rendered below) ─
    if (isMaskPolygonMode) {
      e.stopPropagation();
      // If the selected annotation is a locked mask, refuse to draw at all
      // (no new mask, no edit) — mirroring the vector-shape lock guard.
      const isLockedSelectedMask =
        selAnnotation?.shape?.type === IMAGE_MASK && annotation.isLocked(selAnnotation);
      if (isLockedSelectedMask) return;
      maskPolygonCreateComp?.handleMouseDown(snappedCursor);
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

    // ── Default mode: hit-test mask canvas layer FIRST ────────────
    // Check if the click landed on a mask pixel BEFORE the SVG shape
    // tool selection check, so mask annotations are selectable even
    // when a vector annotation is currently selected.
    const maskHit = hitTestMaskLayer(
      scenePixelCursor[0],
      scenePixelCursor[1],
      (data.annotations?.items ?? []).map((a) => ({
        id: a.id,
        shape: a.shape as Record<string, unknown>,
        value: a.value as Record<string, unknown> | undefined,
      })),
      (ann) => annotation.isHidden({ id: ann.id } as any),
      resolveColorForAnnotation,
    );
    if (maskHit.annotationId) {
      e.stopPropagation();
      selection.selectAnnotation(maskHit.annotation as any);
      return;
    }

    // ── Shift+Drag: start rectangle selection ──────────────────────
    // If shift is held and we're not over a shape handle, start rect selection.
    if (e.shiftKey && viewport.mode === DEFAULT_MODE) {
      isRectSelecting = true;
      rectStart = sceneNormalizedCursor;
      rectEnd = sceneNormalizedCursor;
      e.stopPropagation();
      return;
    }

    // ── Default mode: try editing selected annotation (SVG shapes) ─
    // Pass Alt key so PolygonShape can start vertex box selection
    // (Alt+Drag) even when the drag begins outside the polygon shape.
    if (toolSelection) {
      const consumed = toolSelection.startSelection(sceneNormalizedCursor, e.altKey);
      if (consumed) {
        e.stopPropagation();
        return;
      }
    }

    // Nothing hit — deselect and start panning
    selection.deselect();
    zoomableElement!.mouseDown(e);
  }

  function onMouseUp(e: MouseEvent) {
    // ── Rectangle selection: complete selection ────────────────────
    if (isRectSelecting) {
      rectEnd = sceneNormalizedCursor;
      // A drag commits the rectangle; a plain Shift+Click falls through to
      // handleClick's toggle with the selection untouched.
      finishRectSelection();
      return;
    }

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

    // ── Mask brush mode — flush on pointer up ─────────────────────
    if (isMaskBrushMode) {
      // If the selected annotation is a locked mask, don't flush or open the
      // category popover — the mouse-down guard already refused to paint, so
      // there is no session to flush and no new mask to create.
      const isLockedSelectedMask =
        selAnnotation?.shape?.type === IMAGE_MASK && annotation.isLocked(selAnnotation);
      if (isLockedSelectedMask) return;
      // Save the annotationId BEFORE the flush resets it
      const hadAnnotation = !!maskSession.annotationId;
      maskBrushPointerUp(getDriver());
      // If no annotation was targeted, the flush was a noop.
      // Trigger the category selection popover via onSelection.
      // The parent workspace will create the annotation, and addAnnotation
      // will then call mask_shapes.flush to write the tiles.
      if (!hadAnnotation) {
        onSelection(IMAGE_MASK, []);
      }
      return;
    }

    // Note mode is handled in onSvgClick — defer to click event
    if (isNoteMode) {
      return;
    }

    // Default mode: finalize edit operation on every annotation component.
    //
    // When a non-primary annotation is clicked (Shift+Click to deselect from a
    // multi-selection), its `startSelection` runs during mousedown but the
    // `toolSelection` derived from `selAnnotation` (primary) still points to
    // a *different* component.  That means the clicked component's `panStart`
    // (and any other drag state) would never be cleared, causing the deselected
    // shape to follow the cursor as if it were still being dragged.
    //
    // Iterating all refs guarantees every stale drag is cleaned up.
    // Note: _compRefs holds AnnotationGeometry instances; they expose endSelection
    // through getToolSelection(), not directly.

    // Capture which annotation was being dragged BEFORE clearing drag state.
    let _draggedId: string | null = null;
    if (_multiDragDelta) {
      for (let i = 0; i < visibleAnnotations.length; i++) {
        if (_compRefs[i]?.getIsEditing?.()) {
          _draggedId = visibleAnnotations[i].id;
          break;
        }
      }
    }

    // ── Multi-drag: begin batch collection ───────────────────────────
    // If a multi-shape drag occurred, collect every commit into a single
    // undoable command instead of N separate annotation.update commands.
    const dragDelta = _multiDragDelta; // local const for TS narrowing
    const isBatchCommit = !!dragDelta && (dragDelta[0] !== 0 || dragDelta[1] !== 0);
    if (isBatchCommit) {
      _commitBatch = [];
    }

    for (let i = 0; i < _compRefs.length; i++) {
      _compRefs[i]?.getToolSelection()?.endSelection(sceneNormalizedCursor);
    }

    // ── Multi-drag: commit delta to all other selected annotations ──
    if (dragDelta && (dragDelta[0] !== 0 || dragDelta[1] !== 0)) {
      for (let i = 0; i < visibleAnnotations.length; i++) {
        const ann = visibleAnnotations[i];
        if (!selection.isAnnotationSelected(ann.id)) continue;
        if (ann.id === _draggedId) continue;
        const shape = (ann.shape ?? {}) as IImageAnnotationShape | undefined;
        if (!shape?.points?.length) continue;

        // Shift points based on shape type — some shapes store radii
        // in points that must NOT be translated.
        let movedPoints: Point[];
        if (shape.type === IMAGE_CIRCLE) {
          // points = [[cx, cy]] — only centroid shifts, radius is separate
          movedPoints = [[shape.points[0][0] + dragDelta[0], shape.points[0][1] + dragDelta[1]]];
        } else if (shape.type === IMAGE_ELLIPSE) {
          // points = [[cx, cy], [rx, ry]] — only centroid shifts, radii are separate
          movedPoints = [
            [shape.points[0][0] + dragDelta[0], shape.points[0][1] + dragDelta[1]],
            shape.points[1],
          ];
        } else {
          // All points are positional vertices (bbox, polygon, line)
          movedPoints = shape.points.map((p) => [p[0] + dragDelta[0], p[1] + dragDelta[1]] as Point);
        }

        handleEditComplete(ann.id, movedPoints, {});
      }
    }

    // ── Dispatch the collected multi-drag batch as ONE undoable command ──
    if (_commitBatch) {
      const pending = _commitBatch;
      _commitBatch = null;
      if (pending.length > 0) {
        getDriver().command.call("idah-image:selection.batch-move", { updates: pending });
      }
    }
    _multiDragOrigin = null;
    _multiDragDelta = null;

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

  /**
   * Handle clicks on the container level — catches clicks on the mask canvas
   * layer (which has pointer-events: none and passes through to SVG, but we
   * also handle directly here for robustness).
   */
  function onContainerMouseDown(e: MouseEvent) {
    // Only handle in DEFAULT_MODE — other modes are handled by the SVG handler
    if (viewport.mode !== DEFAULT_MODE) return;
    if (isMaskBrushMode || isMaskPolygonMode) return;

    // Sync mouse position
    mousePosition = [e.offsetX, e.offsetY];

    // Hit-test mask canvas layer
    const maskHit = hitTestMaskLayer(
      scenePixelCursor[0],
      scenePixelCursor[1],
      (data.annotations?.items ?? []).map((a) => ({
        id: a.id,
        shape: a.shape as Record<string, unknown>,
        value: a.value as Record<string, unknown> | undefined,
      })),
      (ann) => annotation.isHidden({ id: ann.id } as any),
      resolveColorForAnnotation,
    );
    if (maskHit.annotationId) {
      e.stopPropagation();
      selection.selectAnnotation(maskHit.annotation as any);
    } else {
      // No mask hit — deselect on empty space click.
      // This is a safety net: the SVG's onMouseDown should have already handled
      // the deselect, but in case the event didn't reach the SVG (e.g. the
      // Viewport layer consumed it), we handle it here.
      selection.deselect();
    }
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
    // Read the annotation BEFORE any mutation — this is our "original" state.
    const ann = data.annotations?.items?.find((r) => r.id === annId);

    if (_commitBatch) {
      // ── Multi-drag batch mode ────────────────────────────────────────
      // Capture the PRE-MOVE snapshot NOW (before the synchronous upsert
      // below mutates the store). Undo restores this exact snapshot, so all
      // shapes return to their original positions in one Ctrl+Z.
      if (ann) {
        const originalShape = ann.shape as IImageAnnotationShape | undefined;
        _commitBatch.push({
          annotationId: annId,
          // Spread the original shape, then apply extraProps (e.g., ellipse
          // angle after rotation), then override points with the moved
          // position. This preserves shape-specific properties like ellipse
          // `angle`, circle `radius`, etc. that the multi-drag loop's
          // extraProps doesn't carry.
          shape: { ...originalShape, ...extraProps, points } as IImageAnnotationShape,
          snapshot: {
            ...ann,
            shape: { ...(ann.shape ?? {}) },
          } as AnnotationItem,
        });
      }
    } else {
      // ── Single-edit path (unchanged) ────────────────────────────────
      // Dispatch FIRST so annotation.update's callback reads the store before
      // the upsert below — this is what lets its snapshot capture the original
      // position.
      onSelection(viewport.mode, points, extraProps, annId);
    }

    // ── Synchronous local data store update to prevent viewport blink ──
    // The dispatched command's async do() will also update the store, but
    // local drag/selection state is cleared synchronously in onMouseUp,
    // which would cause shapes to snap back to their old positions before
    // the async update completes. Updating the local store synchronously
    // here keeps shapes at their new positions through the render that
    // follows, eliminating the blink.
    if (!ann) return;
    const shape = ann.shape as IImageAnnotationShape | undefined;
    if (!shape) return;

    data.annotations!.upsert({
      ...ann,
      shape: { ...shape, points },
    } as any);
  }

  let _hoveringMask = $state(false);
  let _noteHandledByClick = $state(false);
  let _hoverHitTestPending = false;

  function scheduleHoverHitTest(): void {
    if (_hoverHitTestPending) return;
    _hoverHitTestPending = true;
    requestAnimationFrame(() => {
      _hoverHitTestPending = false;
      if (!data.annotations) return;
      const hit = hitTestMaskLayer(
        scenePixelCursor[0],
        scenePixelCursor[1],
        (data.annotations?.items ?? []).map((a) => ({
          id: a.id,
          shape: a.shape as Record<string, unknown>,
          value: a.value as Record<string, unknown> | undefined,
        })),
        (ann) => annotation.isHidden({ id: ann.id } as any),
        resolveColorForAnnotation,
      );
      _hoveringMask = hit.annotationId !== null;
    });
  }

  function handleClick(ann: IAnnotationRecord, e: MouseEvent) {
    // Swallow the click that trails a drag (rectangle selection, or a shape move
    // released over another shape) — mouseup already did the meaningful work, and
    // running Shift+Click toggling here would undo it.
    if (movedSinceMouseDown(e)) return;

    // Note mode: create an annotation-anchored note
    if (isNoteMode) {
      _noteHandledByClick = true;
      showNewNoteFeedPopup(ann as IImageAnnotationRecord);
      return;
    }

    // Don't select annotations in creation mode
    if (viewport.isCreationMode) return;

    // ── Multi-selection: shift+click toggles this annotation ──
    if (e.shiftKey) {
      selection.toggleAnnotation(ann.id);
      return;
    }

    // Don't re-select an already selected annotation — prevents unnecessary
    // _selectedAnnotationIds Set allocation which triggers reactive cascades.
    if (selection.isAnnotationSelected(ann.id)) return;

    selection.selectAnnotation(ann);
  }
</script>

<div class={cn("shapes-container flex-1", pointer)} onmousedown={onContainerMouseDown}>
  <!-- Layer 0: Viewport with image content -->
  <div class="viewport-layer">
    <Viewport bind:this={zoomableElement} onPanStart={() => (isPanning = true)} onPanStop={() => (isPanning = false)}>
      {@render children?.()}
    </Viewport>
  </div>

  <!-- Layer 1: Mask canvas overlay -->
  <MaskCanvasLayer previewColor={previewColor} />

  <!-- Layer 2: SVG overlay for shapes -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    width="100%"
    height="100%"
    {viewBox}
    onkeydown={() => {}}
    bind:this={svgEl}
    onmousedowncapture={onMouseDownCapture}
    onmouseupcapture={onMouseUpCapture}
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onwheel={onWheel}
    onclick={onSvgClick}
  >
    <!-- Crosshair (for build modes) -->
    <Crosshair cursor={sceneMousePosition} visible={showCrosshair} />

    <!-- Rendered annotations -->
    {#each visibleAnnotations as ann, i (ann.id)}
      <AnnotationGeometry
        bind:this={_compRefs[i]}
        annotation={ann}
        selected={selection.isAnnotationSelected(ann.id)}
        editable={viewport.mode === DEFAULT_MODE &&
          selection.isAnnotationSelected(ann.id) &&
          !annotation.isLocked(ann) &&
          !["errored", "completed"].includes(getDriver().entryStatus)}
        cursor={snappedCursor}
        multiDragDelta={_multiDragDelta}
        mode={viewport.mode}
        onClick={(e: MouseEvent) => handleClick(ann, e)}
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

    <!-- Rectangle selection overlay -->
    {#if selectionRect}
      <rect
        x={selectionRect[0] * media.width}
        y={selectionRect[1] * media.height}
        width={(selectionRect[2] - selectionRect[0]) * media.width}
        height={(selectionRect[3] - selectionRect[1]) * media.height}
        fill="rgba(59, 130, 246, 0.2)"
        stroke="#3b82f6"
        stroke-width={1.5}
        vector-effect="non-scaling-stroke"
        pointer-events="none"
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

      <!-- Build mode: polygon creation preview (vector + mask) -->
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

      {#if isMaskPolygonMode && !pendingAnnotation}
        <MaskPolygonCreateShape
          bind:this={maskPolygonCreateComp}
          cursor={snappedCursor}
          mediaWidth={media.width}
          mediaHeight={media.height}
          onFlush={() => {
            // If a mask annotation is currently selected, flush directly
            // to its tiles (same as brush tool). Don't go through
            // onShapeSelection which would strip existing tiles from the
            // local shape. For new annotations, use onSelection to create.
            const sel = selection.value;
            // Defense-in-depth: never commit onto (or spin off a new mask
            // against) a locked mask annotation.
            if (sel && (sel.shape as any)?.type === IMAGE_MASK && annotation.isLocked(sel)) {
              return;
            }
            const existingId = sel && (sel.shape as any)?.type === IMAGE_MASK
              ? sel.id
              : undefined;
            if (existingId) {
              // Edit existing mask — just flush the session tiles
              getDriver().command.call("idah-image:annotation.mask-shapes.flush");
            } else {
              // New mask — trigger creation via onSelection
              onSelection(IMAGE_MASK, []);
            }
          }}
          color={previewColor}
        />
      {/if}

      <!-- Add/remove mode indicator for mask polygon tool (near cursor) -->
      {#if isMaskPolygonMode && !pendingAnnotation}
        {@const invScale = 1 / viewport.workspace.transform.scale}
        {@const px = scenePixelCursor[0]}
        {@const py = scenePixelCursor[1]}
        <text
          x={px}
          y={py - 16 * invScale}
          fill={maskSession.mode === "add" ? "rgba(100,255,100,0.9)" : "rgba(255,100,100,0.9)"}
          font-size={14 * invScale}
          text-anchor="middle"
          dominant-baseline="middle"
          font-weight="bold"
          style:pointer-events="none"
        >{maskSession.mode === "add" ? "+" : "−"}</text>
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

    <!--
      Category labels last, so they sit above every shape. `visibleAnnotations`
      already excludes hidden annotations, so their labels disappear with them.
    -->
    <AnnotationLabels annotations={visibleAnnotations} />
  </svg>

  <!-- Layer 3: Brush cursor overlay (above everything) -->
  {#if isMaskBrushMode}
    {@const invScale = 1 / viewport.workspace.transform.scale}
    {@const px = Math.floor(scenePixelCursor[0]) + 0.5}
    {@const py = Math.floor(scenePixelCursor[1]) + 0.5}
    <svg
      class="brush-cursor-overlay"
      width="100%"
      height="100%"
      {viewBox}
      style:position="absolute"
      style:top="0"
      style:left="0"
      style:pointer-events="none"
      style:z-index="10"
    >
      <circle
        cx={px}
        cy={py}
        r={maskTool.brushRadius}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        stroke-width={1}
        vector-effect="non-scaling-stroke"
      />
      <circle
        cx={px}
        cy={py}
        r={2 * invScale}
        fill="rgba(255,255,255,0.8)"
        vector-effect="non-scaling-stroke"
      />
      <text
        x={px}
        y={py - maskTool.brushRadius - 12 * invScale}
        fill={maskSession.mode === "add" ? "rgba(100,255,100,0.9)" : "rgba(255,100,100,0.9)"}
        font-size={14 * invScale}
        text-anchor="middle"
        dominant-baseline="middle"
        font-weight="bold"
      >{maskSession.mode === "add" ? "+" : "-"}</text>
    </svg>
  {/if}
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
    width: 100%;
    height: 100%;
  }
</style>
