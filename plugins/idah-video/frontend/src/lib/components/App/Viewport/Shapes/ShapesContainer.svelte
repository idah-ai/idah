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
  //   • Supports multi-selection: Shift+Click toggle, Shift+Drag rectangle selection
  //   • Exposes zoomIn/zoomOut helpers
  // ---------------------------------------------------------------------------

  import { onMount, type Snippet } from "svelte";

  import { cn } from "$lib/utils";

  import Viewport from "$lib/components/App/Viewport/Viewport.svelte";
  import FramePendingOverlay from "$lib/components/App/Viewport/FramePendingOverlay.svelte";
  import AnnotationGeometry from "./AnnotationGeometry.svelte";
  import AnnotationLabels from "./AnnotationLabels.svelte";
  import BBoxCreateShape from "./BBoxCreateShape.svelte";
  import PolygonCreateShape from "./PolygonCreateShape.svelte";
  import Crosshair from "./Crosshair.svelte";
  import NoteMarkers from "$lib/components/App/NoteMarkers.svelte";

  import {
    BOUNDING_BOX_MODE,
    EDITOR_MODE,
    NOTE_MODE,
    POLYGON_MODE,
    REVIEW_MODE,
    viewport,
  } from "$lib/state/viewport.svelte";

  import { snapEngine } from "$lib/snap-engine/instance";

  import { magneticSnap } from "$lib/state/magnetic-snap.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data, setPendingNoteScene, type AnnotationItem } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { snapDebug } from "$lib/state/ui.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import noteIconSvg from "$lib/assets/icons/message-circle.svg?raw";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { nearFirstPolygonPoint } from "./Polygon/utils";
  import { rotatePointN } from "./BoundingBox/utils";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import {
    NON_DRAWABLE_SHAPE_TYPES,
    type IVideoAnnotationRecord,
    type IVideoAnnotationShape,
    type IVideoFrameSelection,
  } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { centroid as centroidUtil } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { resolveAnnotationColor } from "$lib/utils/color";

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
    frame: number;
    annotations_promise: Promise<IVideoAnnotationRecord[]>;
    children: Snippet;
    onSelectAnnotation: (annotation?: IVideoAnnotationRecord) => void;
    onSelection: (type: string, frame: number, points?: Point[], angle?: number, id?: string) => void;
    onAddNewNote: (params: OnAddNewNoteParams) => void;
    onChangeFrame?: (newFrame: number) => void;
    isPlaying: boolean;
    /** A pending annotation (could be missing category) waiting for popover confirmation. */
    pendingAnnotation?: IVideoAnnotationRecord;
    /** Category color from the workspace's pendingValue — used for creation previews when category is selected. */
    categoryColor?: string;
  };

  let {
    frame,
    children,
    onSelection,
    onAddNewNote,
    isPlaying,
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
  let _snapResult = $state<{ point: [number, number]; kind: string; sourceShapeId?: string } | null>(null);

  /** Resolve the snap indicator color from the source annotation's category, or default to #00FF88. */
  let snapColor = $derived.by((): string => {
    const snap = _snapResult;
    if (!snap?.sourceShapeId) return "#00FF88";
    const src = visibleAnnotations.find((a: any) => a.id === snap.sourceShapeId);
    if (!src) return "#00FF88";
    return resolveAnnotationColor(src);
  });

  /** Cursor in scene pixel space — used for snap queries (avoids normalized-space aspect-ratio issues). */
  let scenePixelCursor: [number, number] = $derived.by((): [number, number] => {
    const sv = viewport.workspace.screenToScene(mousePosition[0], mousePosition[1]);
    return [sv.x, sv.y];
  });

  /** Cursor after snap correction (in normalized space for creation shapes). */
  let snappedCursor = $derived.by((): [number, number] => {
    if (magneticSnap.enabled && _snapResult) {
      return [
        media.width > 0 ? _snapResult.point[0] / media.width : 0,
        media.height > 0 ? _snapResult.point[1] / media.height : 0,
      ];
    }
    return sceneNormalizedCursor;
  });

  /** Threshold in scene pixels: ~10 screen pixels adjusted for zoom. */
  let snapThreshold = $derived(viewport.workspace.transform.scale > 0 ? 10 / viewport.workspace.transform.scale : 10);

  // ── Viewport ref ──────────────────────────────────────────────────────
  let zoomableElement = $state<Viewport | undefined>(undefined);

  // ── Component refs for tool selection ─────────────────────────────────
  let _compRefs: any[] = $state([]);

  // Build a flat list of visible annotations (filtered by current frame and hidden state).
  // The list is ordered so selected annotations always come last (highest z-order in SVG),
  // and non-selected annotations are ordered by creation (earliest first).
  // This ensures overlapping shapes always have the selected ones on top.
  let visibleAnnotations = $derived.by<IAnnotationRecord[]>(() => {
    const frame = viewport.video.displayedFrame.value;
    const items = data.annotations?.items ?? [];

    // Single-pass: filter visible annotations while partitioning selected vs rest
    const { rest, selected } = items.reduce<{
      rest: IAnnotationRecord[];
      selected: IAnnotationRecord[];
    }>(
      (acc, ann) => {
        // Skip hidden annotations
        if (annotation.isHidden(ann)) return acc;
        // Skip non-drawable records (entry:root / idah-video:frame) — they
        // are never rendered on canvas and are only edited through the Tagging tab.
        if (NON_DRAWABLE_SHAPE_TYPES.has((ann.shape as { type?: string })?.type ?? "")) return acc;
        // Skip annotations outside the current frame range
        const { start, end } = (ann.shape ?? {}) as { start?: number; end?: number };
        if (start == null || end == null || frame < start || frame > end) return acc;
        // Separate selected annotations (go at end for z-order) from the rest
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

  // Derive tool selection from the primary (first) selected annotation's component
  // In multi-selection mode, only the primary annotation gets edit handles.
  let selAnnotation = $derived.by((): IAnnotationRecord | undefined => {
    if (!selection.isAnnotation()) return undefined;
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
  let polygonCreateComp: PolygonCreateShape | undefined = $state(undefined);

  let isBoundingBoxMode = $derived(viewport.mode === BOUNDING_BOX_MODE);
  let isPolygonMode = $derived(viewport.mode === POLYGON_MODE);
  let isNoteMode = $derived(viewport.mode === NOTE_MODE);

  /** Preview color for create-shape overlays — uses categoryColor or falls back to pendingAnnotation's category. */
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
    const s = viewport.workspace.transform.scale || 1;
    const mw = media.width || 1;
    const mh = media.height || 1;
    return [-tx / s / mw, -ty / s / mh, (-tx + w) / s / mw, (-ty + h) / s / mh];
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
    selection: IVideoFrameSelection;
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

  // ── Resize observer to sync dimensions ────────────────────────────────
  function syncDimensions() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewport.workspace.dimensions[0] = rect.width;
    viewport.workspace.dimensions[1] = rect.height;
  }

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
      anns.map((ann) => {
        const shape = ann.shape as IVideoAnnotationShape | undefined;
        if (!shape) {
          return { id: ann.id, kind: "", data: null };
        }
        // Resolve interpolated geometry for the current displayed frame
        const interpolated = getInterpolatedFrame(shape, viewport.video.displayedFrame.value);
        if (!interpolated || !interpolated.points) {
          // Shape has no keyframe data for this frame — skip by returning unknown kind
          return { id: ann.id, kind: "", data: null };
        }
        return {
          id: ann.id,
          kind: shape.type,
          data: { points: interpolated.points, angle: interpolated.angle },
        };
      }),
      media.width,
      media.height,
    );
  });

  onMount(() => {
    viewport.svgElement = svgEl ?? null;
    const ro = new ResizeObserver(() => syncDimensions());
    if (svgEl) ro.observe(svgEl);
    syncDimensions();

    // Fit video to viewport on initial load
    requestAnimationFrame(() => viewport.workspace.fitToViewport());

    const cursorSvg = encodeURIComponent(noteIconSvg.replace('fill="none"', 'fill="white"'));
    const style = document.createElement("style");
    style.textContent = `
      .cursor-note { cursor: url('data:image/svg+xml;charset=utf-8,${cursorSvg}') 0 24, auto; }
      .cursor-crosshair { cursor: crosshair; }
      .cursor-grab { cursor: grab; }
      /* !important so an active grab also beats the shapes' inline style:cursor */
      .cursor-grabbing, .cursor-grabbing * { cursor: grabbing !important; }
      .cursor-pointer { cursor: pointer; }
      .cursor-target { cursor: alias; }
      /* Applied to <body> while a viewport gesture is live: a drag that leaves the
         SVG would otherwise start a native text selection across the sidebars and
         timeline it passes over. */
      .idah-video-dragging, .idah-video-dragging * { user-select: none !important; -webkit-user-select: none !important; }
    `;
    document.head.appendChild(style);

    return () => {
      ro.disconnect();
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
    if (isNoteMode) return "cursor-note";
    if (hoveringFirstPoint) return "cursor-target";
    if (viewport.isCreationMode) return "cursor-crosshair";
    if (selAnnotation) return "cursor-pointer";

    return "cursor-grab";
  });

  let showCrosshair = $derived(
    !viewport.video.framePending &&
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

  // ── Rectangle selection helpers ────────────────────────────────────────

  /** Compute the AABB of an annotation's interpolated shape at the current frame. Returns null if no geometry. */
  function getAnnotationAABB(ann: IAnnotationRecord): [number, number, number, number] | null {
    const shape = (ann as any).shape as IVideoAnnotationShape | undefined;
    if (!shape?.frames?.length) return null;
    const interp = getInterpolatedFrame(shape, viewport.video.displayedFrame.value);
    if (!interp?.points?.length) return null;

    // `points` holds the unrotated corners — `angle` is applied as a render
    // transform around the centroid (see BBoxShape's transform-origin), so the
    // box must be rotated the same way here. Otherwise a rotated annotation is
    // hit-tested against the bounds it would occupy at 0°, which is not where
    // the user sees it. rotatePointN does the math in pixel space, matching the
    // render; polygons carry no angle and skip this untouched.
    const angle = interp.angle ?? 0;
    let pts = interp.points;
    if (angle !== 0 && media.width > 0 && media.height > 0) {
      const center = centroidUtil(pts);
      pts = pts.map((p) => rotatePointN(p, center, angle, media.width, media.height));
    }

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
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
    document.body.classList.add("idah-video-dragging");
  }

  function endGestureTracking() {
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
    document.body.classList.remove("idah-video-dragging");
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

  // ── Event handlers ───────────────────────────────────────────────────
  function onMouseMove(e: MouseEvent) {
    handlePointerMove(e, [e.offsetX, e.offsetY], false);
  }

  function handlePointerMove(e: MouseEvent, position: Point, fromDocument: boolean) {
    mousePosition = position;

    // Track the last known cursor position in normalized coords so commands
    // (e.g. selection.paste) can target where the user's cursor currently is.
    viewport.cursor = [sceneNormalizedCursor[0], sceneNormalizedCursor[1]];

    // ── Rectangle selection tracking ───────────────────────────────
    if (isRectSelecting) {
      rectEnd = sceneNormalizedCursor;
      return;
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

    // Only pan in editor mode. Never forward a document-sourced event: its
    // offsetX/offsetY are relative to whatever element happens to be under the
    // cursor, and Viewport installs its own document listeners once a pan starts.
    if (!fromDocument && (viewport.mode === EDITOR_MODE || viewport.mode === REVIEW_MODE)) {
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
    beginGestureTracking();

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

    // ── Note mode — defer to mouseup ───────────────────────────────
    if (isNoteMode) {
      return;
    }

    // ── Review mode: deselect and start panning (no shape editing) ─
    if (viewport.mode === REVIEW_MODE) {
      selection.deselect();
      zoomableElement!.mouseDown(e);
      return;
    }

    // ── Shift+Drag: start rectangle selection ──────────────────────
    // If shift is held and we're not over a shape handle, start rect selection.
    // Shape components call stopPropagation on mousedown if they consumed it,
    // so this only fires when clicking empty space or a non-editable shape.
    if (e.shiftKey && viewport.mode === EDITOR_MODE) {
      isRectSelecting = true;
      rectStart = sceneNormalizedCursor;
      rectEnd = sceneNormalizedCursor;
      e.stopPropagation();
      return;
    }

    // ── Default mode: try editing selected annotation ──────────────
    if (toolSelection && isEditable()) {
      // Pass the actual Alt key state so PolygonShape can start vertex box
      // selection (Alt+Drag) even when the drag begins outside the polygon
      // shape on the SVG background.
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

    // Note mode — entry-note creation is handled via onClick on the <svg> element,
    // not onMouseUp, because shape components call stopPropagation on mousedown
    // which prevents mouseup from bubbling. The click event fires regardless.
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
    // undoable command instead of N separate keyframe.add commands.
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
        const shape = (ann as any).shape as IVideoAnnotationShape | undefined;
        if (!shape?.frames?.length) continue;
        const interp = getInterpolatedFrame(shape, viewport.video.displayedFrame.value);
        if (!interp?.points?.length) continue;
        const movedPoints = interp.points.map((p) => [p[0] + dragDelta[0], p[1] + dragDelta[1]] as Point);
        handleEditComplete(ann.id, movedPoints, interp.angle ?? 0);
      }
    }

    // ── Dispatch the collected multi-drag batch as ONE undoable command ──
    if (_commitBatch) {
      const pending = _commitBatch;
      _commitBatch = null;

      if (pending.length > 0) {
        getDriver().command.call("idah-video:selection.batch-move", { updates: pending });
      }
    }
    _multiDragOrigin = null;
    _multiDragDelta = null;

    // Only pan on mouseup if we were panning
    zoomableElement!.mouseUp(e);
  }

  function showNewNoteFeedPopup(annotation?: IVideoAnnotationRecord) {
    // Use scene-normalized cursor so markers track video content under pan/zoom.
    // sceneNormalizedCursor is in 0-1 normalized media space.
    const rect = viewport.svgElement!.getBoundingClientRect();
    const screenX = rect.left + mousePosition[0];
    const screenY = rect.top + mousePosition[1];
    const params: OnAddNewNoteParams = {
      anchorType: annotation ? ("annotation" as const) : ("entry" as const),
      position: {
        x: sceneNormalizedCursor[0],
        y: sceneNormalizedCursor[1],
        frame,
      },
      annotationId: (annotation?.metadata?.id as string | undefined) || null,
      screenX,
      screenY,
    };
    // Show a temporary marker at the click position
    setPendingNoteScene({
      type: "entry",
      x: sceneNormalizedCursor[0],
      y: sceneNormalizedCursor[1],
      frame,
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
    const currentFrame = viewport.video.displayedFrame.value;
    // Read the annotation BEFORE any mutation — this is our "original" state.
    const ann = data.annotations?.items?.find((r) => r.id === annId);

    if (_commitBatch) {
      // ── Multi-drag batch mode ────────────────────────────────────────
      // Capture the PRE-MOVE snapshot NOW (before the synchronous upsert
      // below mutates the store). Undo restores this exact snapshot, so all
      // shapes return to their original positions in one Ctrl+Z.
      if (ann) {
        _commitBatch.push({
          annotationId: annId,
          selection: { frame: currentFrame, points, angle },
          snapshot: {
            ...ann,
            shape: {
              ...(ann.shape ?? {}),
              frames: [...((ann.shape?.frames as any[]) ?? [])],
            },
          } as AnnotationItem,
        });
      }
    } else {
      // ── Single-edit path (unchanged) ────────────────────────────────
      // Dispatch FIRST so keyframe.add's callback reads the store before the
      // upsert below — this is what lets its snapshot capture the original
      // position.
      onSelection(viewport.mode, frame, points, angle, annId);
    }

    // ── Synchronous local data store update to prevent viewport blink ──
    // The dispatched command's async do() will also update the store, but
    // local drag/selection state is cleared synchronously in onMouseUp,
    // which would cause shapes to snap back to their old positions before
    // the async update completes. Updating the local store synchronously
    // here keeps shapes at their new positions through the render that
    // follows, eliminating the blink.
    if (!ann) return;
    const shape = ann.shape as IVideoAnnotationShape | undefined;
    if (!shape?.frames?.length) return;
    const frames = [...shape.frames];
    const existingIdx = frames.findIndex((f) => f.frame === currentFrame);
    const newSelection: IVideoFrameSelection = { frame: currentFrame, points, angle };
    if (existingIdx >= 0) frames[existingIdx] = newSelection;
    else frames.push(newSelection);
    frames.sort((a, b) => a.frame - b.frame);

    const min = frames.reduce((m, f) => Math.min(m, f.frame), Infinity);
    const max = frames.reduce((m, f) => Math.max(m, f.frame), -Infinity);

    data.annotations!.upsert({
      ...ann,
      shape: { ...shape, start: min, end: max, frames },
    } as any);
  }

  let _noteHandledByClick = false;

  /**
   * Handle click on an annotation shape.
   * - Shift+Click: toggle the annotation in/out of the selection.
   * - Plain Click: select only that annotation.
   */
  function handleClick(ann: IAnnotationRecord, event?: MouseEvent) {
    // Swallow the click that trails a drag (rectangle selection, or a shape move
    // released over another shape) — mouseup already did the meaningful work, and
    // running Shift+Click toggling here would undo it.
    if (event && movedSinceMouseDown(event)) return;

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

      // Show a temporary marker at the click position — tracks annotation centroid across frames
      setPendingNoteScene({
        type: "annotation",
        annotationId: ann.id,
        x: sceneNormalizedCursor[0] - centroidN[0],
        y: sceneNormalizedCursor[1] - centroidN[1],
        frame,
      });
      const rect = viewport.svgElement!.getBoundingClientRect();
      const screenX = rect.left + mousePosition[0];
      const screenY = rect.top + mousePosition[1];
      onAddNewNote({
        anchorType: "annotation",
        position: {
          x: sceneNormalizedCursor[0] - centroidN[0],
          y: sceneNormalizedCursor[1] - centroidN[1],
          frame,
        },
        annotationId: ann.id,
        screenX,
        screenY,
      });
      // Exit note tool mode — return to review workspace
      getDriver().setMode("review");
      return;
    }

    // Don't select annotations in creation mode
    if (viewport.isCreationMode) {
      return;
    }

    // Shift+Click: toggle annotation in/out of the multi-selection
    if (event?.shiftKey) {
      selection.toggleAnnotation(ann.id);
      return;
    }

    // Plain click on an already-selected annotation: keep selection as-is
    if (selection.isAnnotationSelected(ann.id)) return;

    // Plain click: select only this annotation
    selection.selectAnnotation(ann);
    getDriver().command.call("idah-video:timeline.scroll-to-annotation");
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
    onmousedowncapture={onMouseDownCapture}
    onmousedown={onMouseDown}
    onclick={onSvgClick}
    onmousemove={onMouseMove}
    onwheel={onWheel}
  >
    <!-- Crosshair (for build modes) -->
    <Crosshair cursor={sceneMousePosition} visible={showCrosshair} />

    <!--
      Rendered annotations — ui.annotationOpacity is applied inside BBoxShape/PolygonShape
      as a fill-opacity multiplier only, so the border stroke always stays at full opacity
      regardless of the slider. Scoped to existing annotations only: creation previews, the
      pending annotation, and note markers below are unaffected.
    -->
    {#each visibleAnnotations as ann, i (ann.id)}
      <AnnotationGeometry
        bind:this={_compRefs[i]}
        annotation={ann}
        selected={selection.isAnnotationSelected(ann.id)}
        editable={viewport.mode === EDITOR_MODE &&
          selection.isAnnotationSelected(ann.id) &&
          !annotation.isLocked(ann) &&
          !["errored", "completed"].includes(getDriver().entryStatus)}
        cursor={snappedCursor}
        multiDragDelta={_multiDragDelta}
        mode={viewport.mode}
        onClick={(e: MouseEvent) => handleClick(ann, e)}
        onEditComplete={(aabb: Point[], angle: number) => handleEditComplete(ann.id, aabb, angle)}
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
          {frame}
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
          {frame}
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

      <!-- Note markers (SVG g — viewBox handles pan/zoom tracking automatically) -->
      {#if viewport.isReviewWorkspace}
        <NoteMarkers />
      {/if}
    </g>

    <!--
      Category labels last, so they sit above every shape. `visibleAnnotations`
      already excludes hidden annotations and those outside the current frame
      range, so their labels disappear with them.
    -->
    <AnnotationLabels annotations={visibleAnnotations} />
  </svg>

  <!-- Layer 2: Frame-pending blocking overlay -->
  <FramePendingOverlay {zoomableElement} />
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
