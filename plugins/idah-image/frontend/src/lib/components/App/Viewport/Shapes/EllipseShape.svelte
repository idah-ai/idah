<script lang="ts">
  // ---------------------------------------------------------------------------
  // EllipseShape.svelte — Ellipse annotation shape
  //
  // Renders an ellipse defined by:
  //   shape.points = [[cx, cy], [rx, ry]]  // centroid + radii (normalized)
  //   shape.angle = angle_in_radians        // rotation around centroid
  //
  // Editing follows the exact same pattern as BBoxShape:
  //   • Internally works with AABB (4 corners) during drag
  //   • Converts to/from centroid+radii only at boundaries
  //   • Handler hidden during editing, so mouse events hit SVG directly
  //
  // Selection API:
  //   • startSelection(point) → returns true if point is on ellipse or inside
  //   • endSelection(point) → finalises the edit
  // ---------------------------------------------------------------------------
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { centroid as centroidUtil, type Point } from "$lib/utils/math/point";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import EllipseHandler from "./Ellipse/_EllipseHandler.svelte";
  import {
    ellipseAABB,
    inverseRotatePointN,
    rotateCursorSVG,
    rotatedCursorSVG,
    rotatePointN,
  } from "./Ellipse/utils";

  import { DEFAULT_MODE, type IImageAnnotationShape } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────
  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps: Record<string, unknown>) => void;
  };

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = DEFAULT_MODE,
    onClick,
    onEditComplete,
  }: Props = $props();

  let color = $derived.by(() => resolveAnnotationColor(annotation));
  let shapeStyleString = $derived.by(() => resolveShapeStyles(annotation));

  let w = $derived(media.width);
  let h = $derived(media.height);

  // ── Interpolated values ──────────────────────────────────────────────
  let baseAngle = $derived.by((): number => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return (shape?.angle as number) ?? 0;
  });

  let baseCentroid = $derived.by((): Point => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    const pts = shape?.points ?? [];
    return pts.length > 0 ? (pts[0] as Point) : [0.5, 0.5];
  });

  let baseRadii = $derived.by((): [number, number] => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    const pts = shape?.points ?? [];
    if (pts.length >= 2) return [pts[1][0] as number, pts[1][1] as number];
    return [0.1, 0.05];
  });

  // ── Derived AABB (4 corner points, same coordinate frame as BBox) ─────
  let baseAABB = $derived.by((): Point[] => ellipseAABB(baseCentroid, baseRadii[0], baseRadii[1]));

  // ── Editing state (identical to BBoxShape) ─────────────────────────────
  let _localPoints: Point[] | undefined = $state();
  let _localAngle: number | undefined = $state();

  let panStart: Point | undefined = $state();
  let rotateStart: Point | undefined = $state();
  let rotateStartAngle: number | undefined = $state();
  let rotateStartRevolutions: number | undefined = $state();
  let resizeHandleIndex: number | undefined = $state();
  let resizeInitialPoints: Point[] = $state([]);
  let activeCursor: string | undefined = $state();

  let isEditing = $derived(editable && (!!panStart || !!rotateStart || resizeHandleIndex !== undefined));

  let angle = $derived(_localAngle ?? baseAngle);
  let points: Point[] = $derived(_localPoints ?? baseAABB);

  // ── Centroid + radii from AABB (for rendering the <ellipse>) ──────────
  let centroidN = $derived.by((): Point => {
    if (points.length < 4) return [0.5, 0.5];
    return centroidUtil(points);
  });

  let radiiFromPoints = $derived.by((): [number, number] => {
    if (points.length < 4) return [0.1, 0.05];
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return [Math.max(0, (Math.max(...xs) - Math.min(...xs)) / 2),
            Math.max(0, (Math.max(...ys) - Math.min(...ys)) / 2)];
  });

  // ── Pixel-space helpers ──────────────────────────────────────────────
  let cursorPx = $derived.by((): Point | undefined => {
    if (!cursor) return undefined;
    return [cursor[0] * w, cursor[1] * h];
  });

  let centroidPx = $derived.by((): Point => [centroidN[0] * w, centroidN[1] * h]);

  // ── Pan offset (normalized) — same as BBoxShape ──────────────────────
  let panOffset = $derived.by((): Point => {
    if (panStart && cursorPx) {
      return [(cursorPx[0] - panStart[0]) / w, (cursorPx[1] - panStart[1]) / h];
    }
    return [0, 0];
  });

  // ── Display points (include pan offset) — same as BBoxShape ──────────
  let displayPoints = $derived.by((): Point[] => {
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      return points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]] as Point);
    }
    return points;
  });

  let displayCentroid = $derived.by((): Point => {
    if (displayPoints.length < 4) return [0.5, 0.5];
    return centroidUtil(displayPoints);
  });

  let displayRadii = $derived.by((): [number, number] => {
    if (displayPoints.length < 4) return [0.1, 0.05];
    const xs = displayPoints.map(p => p[0]);
    const ys = displayPoints.map(p => p[1]);
    return [Math.max(0, (Math.max(...xs) - Math.min(...xs)) / 2),
            Math.max(0, (Math.max(...ys) - Math.min(...ys)) / 2)];
  });

  // ── Resize effect (same as BBoxShape) ─────────────────────────────────
  let lastResizeCursor: Point = $state([-1, -1]);

  $effect(() => {
    if (!cursorPx || resizeHandleIndex === undefined || resizeInitialPoints.length !== 4) return;
    if (cursorPx[0] === lastResizeCursor[0] && cursorPx[1] === lastResizeCursor[1]) return;
    lastResizeCursor = cursorPx;
    handleResize(resizeHandleIndex, cursorPx);
  });

  // ── Current angle (same as BBoxShape) ─────────────────────────────────
  function currentAngle(): number {
    if (rotateStart && rotateStartAngle !== undefined && rotateStartRevolutions !== undefined && cursorPx) {
      const cp: Point = [centroidN[0] * w, centroidN[1] * h];
      const rel: Point = [cursorPx[0] - cp[0], cursorPx[1] - cp[1]];
      const cursorAngle = Math.atan2(rel[0], -rel[1]);
      return cursorAngle + rotateStartRevolutions * 2 * Math.PI;
    }
    return angle;
  }

  // ── Resize logic (BBox fixed-point anchor) ─────────────────────────
  //
  // Each handle drags one corner or edge, while the opposite corner/edge
  // stays fixed in screen space — prevents sides from drifting.
  // Normalize with min/max so flips (dragging past centroid) collapse
  // cleanly to a line and then invert.
  // -----------------------------------------------------------------------
  function handleResize(handleIndex: number, cursorPosPx: Point) {
    if (resizeInitialPoints.length !== 4) return;

    const curAngle = currentAngle();
    const cursorN: Point = [cursorPosPx[0] / w, cursorPosPx[1] / h];
    const initCentroid = centroidUtil(resizeInitialPoints);
    const uCur = inverseRotatePointN(cursorN, initCentroid, curAngle, w, h);

    const [tl, tr, br, bl] = resizeInitialPoints;

    let nx1 = tl[0], ny1 = tl[1], nx2 = br[0], ny2 = br[1];
    let fixedPoint: Point;

    if (handleIndex % 2 === 0) {
      const cornerIdx = handleIndex / 2;
      switch (cornerIdx) {
        case 0: nx1 = uCur[0]; ny1 = uCur[1]; fixedPoint = br; break;
        case 1: nx2 = uCur[0]; ny1 = uCur[1]; fixedPoint = bl; break;
        case 2: nx2 = uCur[0]; ny2 = uCur[1]; fixedPoint = tl; break;
        default: nx1 = uCur[0]; ny2 = uCur[1]; fixedPoint = tr; break;
      }
    } else {
      const edgeIdx = Math.floor(handleIndex / 2);
      switch (edgeIdx) {
        case 0: ny1 = uCur[1]; fixedPoint = [(tl[0] + br[0]) / 2, br[1]]; break;
        case 1: nx2 = uCur[0]; fixedPoint = [tl[0], (tl[1] + br[1]) / 2]; break;
        case 2: ny2 = uCur[1]; fixedPoint = [(tl[0] + br[0]) / 2, tl[1]]; break;
        default: nx1 = uCur[0]; fixedPoint = [br[0], (tl[1] + br[1]) / 2]; break;
      }
    }

    const newPts: Point[] = [
      [nx1, ny1], [nx2, ny1], [nx2, ny2], [nx1, ny2],
    ];

    let newFixedPoint: Point;
    if (handleIndex % 2 === 0) {
      const oppositeCorner = (handleIndex / 2 + 2) % 4;
      newFixedPoint = newPts[oppositeCorner];
    } else {
      const oppositeEdge = (Math.floor(handleIndex / 2) + 2) % 4;
      const next = (oppositeEdge + 1) % 4;
      newFixedPoint = [
        (newPts[oppositeEdge][0] + newPts[next][0]) / 2,
        (newPts[oppositeEdge][1] + newPts[next][1]) / 2,
      ];
    }

    const fixedScreen = rotatePointN(fixedPoint, initCentroid, curAngle, w, h);
    const newCentroid = centroidUtil(newPts);
    const newFixedScreen = rotatePointN(newFixedPoint, newCentroid, curAngle, w, h);

    _localPoints = newPts.map((p) => [
      p[0] + (fixedScreen[0] - newFixedScreen[0]),
      p[1] + (fixedScreen[1] - newFixedScreen[1]),
    ]) as Point[];
  }

  // ── Emit complete (AABB → centroid+radii) ────────────────────────────
  function emitComplete() {
    const pts = _localPoints ?? points;
    const ang = _localAngle ?? angle;
    if (pts.length < 4) return;
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const center: Point = centroidUtil(pts);
    const rx = Math.max(0, (Math.max(...xs) - Math.min(...xs)) / 2);
    const ry = Math.max(0, (Math.max(...ys) - Math.min(...ys)) / 2);
    onEditComplete?.([center, [rx, ry]] as Point[], { angle: ang });
  }

  // ── Selection API (same as BBoxShape) ────────────────────────────────
  const HANDLE_RADIUS_PX = 6;
  const ROTATE_RADIUS_PX = 7;
  const HANDLE_RADIUS_PX_SQR = HANDLE_RADIUS_PX * HANDLE_RADIUS_PX;
  const ROTATE_RADIUS_PX_SQR = ROTATE_RADIUS_PX * ROTATE_RADIUS_PX;

  export function startSelection(start: Point, _shiftKey?: boolean): boolean {
    if (!editable || points.length !== 4) return false;

    const curAngle = currentAngle();
    const startRotated = curAngle !== 0 ? inverseRotatePointN(start, centroidN, curAngle, w, h) : start;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const isInside = startRotated[0] >= Math.min(...xs) && startRotated[0] <= Math.max(...xs) &&
                     startRotated[1] >= Math.min(...ys) && startRotated[1] <= Math.max(...ys);
    if (!isInside) return false;

    const scale = viewport.workspace.transform.scale;

    // 1. Check resize handles
    const handles = points.map((p) => rotatePointN(p, centroidN, curAngle, w, h));
    for (let i = 0; i < handles.length; i++) {
      const dx = Math.abs(start[0] - handles[i][0]) * w * scale;
      const dy = Math.abs(start[1] - handles[i][1]) * h * scale;
      if (dx * dx + dy * dy < HANDLE_RADIUS_PX_SQR) {
        resizeHandleIndex = i;
        resizeInitialPoints = [...points];
        _localPoints = [...points];
        activeCursor = rotatedCursorSVG(i, currentAngle(), color);
        return true;
      }
    }

    // 2. Check rotation handle
    {
      const allY = points.map(p => p[1]);
      const allX = points.map(p => p[0]);
      const topMidN: Point = [(Math.min(...allX) + Math.max(...allX)) / 2, Math.min(...allY)];
      const handleDist = 70 / Math.min(w, h);
      const rotHandleN: Point = [topMidN[0], topMidN[1] - radiiFromPoints[1] - handleDist];
      const rotHandleRotated = rotatePointN(rotHandleN, centroidN, curAngle, w, h);
      const rdx = Math.abs(start[0] - rotHandleRotated[0]) * w * scale;
      const rdy = Math.abs(start[1] - rotHandleRotated[1]) * h * scale;
      if (rdx * rdx + rdy * rdy < ROTATE_RADIUS_PX_SQR) {
        rotateStart = centroidN;
        rotateStartRevolutions = Math.round(curAngle / (2 * Math.PI));
        const cp: Point = [centroidN[0] * w, centroidN[1] * h];
        const rel: Point = [start[0] * w - cp[0], start[1] * h - cp[1]];
        rotateStartAngle = Math.atan2(rel[0], -rel[1]);
        activeCursor = rotateCursorSVG(color);
        return true;
      }
    }

    // 3. Body → start pan
    panStart = [start[0] * w, start[1] * h];
    _localPoints = [...points];
    return true;
  }

  export function endSelection(_end: Point) {
    let changed = false;
    if (panStart) {
      if (panOffset[0] !== 0 || panOffset[1] !== 0) {
        _localPoints = points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]] as Point);
        changed = true;
      }
      panStart = undefined;
    } else if (rotateStart) {
      _localAngle = currentAngle();
      rotateStart = undefined;
      rotateStartAngle = undefined;
      rotateStartRevolutions = undefined;
      activeCursor = undefined;
      changed = true;
    } else if (resizeHandleIndex !== undefined) {
      changed = true;
      resizeHandleIndex = undefined;
      resizeInitialPoints = [];
      activeCursor = undefined;
    }
    if (changed) emitComplete();
    _localAngle = undefined;
    _localPoints = undefined;
  }

  // ── Cursor style ──────────────────────────────────────────────────────
  let bodyCursor = $derived(
    mode === "note" ? "cursor-note" :
    isEditing ? "cursor-grabbing" :
    editable && selected ? "cursor-grab" :
    "cursor-pointer"
  );
</script>

{#if points.length >= 4}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ellipse
    cx={displayCentroid[0] * w}
    cy={displayCentroid[1] * h}
    rx={displayRadii[0] * w}
    ry={displayRadii[1] * h}
    fill={color}
    fill-opacity={selected ? 0.6 : 0.3}
    stroke={color.replace("0.5", "1")}
    stroke-width={selected ? 1.5 : 1}
    style:transform-origin="{displayCentroid[0] * w}px {displayCentroid[1] * h}px"
    style:transform="rotate({currentAngle()}rad)"
    vector-effect="non-scaling-stroke"
    style={shapeStyleString}
    class={bodyCursor}
    style:outline="none"
    role="button"
    tabindex="-1"
    onclick={onClick}
    onmousedown={(e) => {
      if (viewport.isCreationMode) return;
      if (viewport.mode === "review") return;
      if (editable && selected && cursor) {
        startSelection(cursor);
      }
      e.stopPropagation();
    }}
  />

  {#if editable && selected && !isEditing && displayPoints.length === 4}
    <EllipseHandler
      centroid={displayCentroid}
      radiusX={displayRadii[0]}
      radiusY={displayRadii[1]}
      currentAngle={currentAngle()}
      {color}
      {isEditing}
      {cursorPx}
      onStartResize={(idx) => {
        resizeHandleIndex = idx;
        resizeInitialPoints = [...points];
        _localPoints = [...points];
        activeCursor = rotatedCursorSVG(idx, currentAngle(), color);
      }}
      onStartRotate={(cp) => {
        rotateStart = centroidN;
        rotateStartRevolutions = Math.round(currentAngle() / (2 * Math.PI));
        const rel: Point = [cp[0] - centroidPx[0], cp[1] - centroidPx[1]];
        rotateStartAngle = Math.atan2(rel[0], -rel[1]);
        activeCursor = rotateCursorSVG(color);
      }}
      onDecrementRevolution={() => {
        _localAngle = (angle ?? 0) - 2 * Math.PI;
        emitComplete();
      }}
      onIncrementRevolution={() => {
        _localAngle = (angle ?? 0) + 2 * Math.PI;
        emitComplete();
      }}
      revolutionDisplay={rotateStartRevolutions !== undefined
        ? `(${rotateStartRevolutions > 0 ? "+" : ""}${rotateStartRevolutions} rev)`
        : ""}
      rotateStart={!!rotateStart}
    />
  {/if}

  {#if activeCursor && cursorPx && isEditing}
    <g style="pointer-events: none;">
      <g transform="translate({cursorPx[0]}, {cursorPx[1]}) scale({1 / viewport.workspace.transform.scale})">
        <image href={activeCursor} x="-18" y="-18" width="36" height="36" />
      </g>
    </g>
  {/if}
{/if}
