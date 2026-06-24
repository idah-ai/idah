<script lang="ts">
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { normalizeRect } from "$lib/utils/math/bbox";
  import { centroid as centroidUtil, type Point } from "$lib/utils/math/point";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import BBoxHandler from "./BoundingBox/_BBoxHandler.svelte";
  import {
    boundingBoxHandle,
    inverseRotatePointN,
    rotateCursorSVG,
    rotatedCursorSVG,
    rotatePointN,
  } from "./BoundingBox/utils";

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

  // ── Shape display styles from property options ─────────────────────────
  let shapeStyleString = $derived.by(() => resolveShapeStyles(annotation));

  // ── Media dimensions (pixel space) ─────────────────────────────────────
  let w = $derived(media.width);
  let h = $derived(media.height);

  // ── Interpolated values ──────────────────────────────────────────────
  let baseAngle = $derived.by((): number => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return shape?.angle as number ?? 0;
  });

  // ── Editing state ───────────────────────────────────────────────────────
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

  let basePoints = $derived.by((): Point[] => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return shape?.points ?? [];
  });

  let angle = $derived(_localAngle ?? baseAngle);
  let points: Point[] = $derived(_localPoints ?? basePoints);

  // ── Pixel-space cursor ────────────────────────────────────────────────
  let cursorPx = $derived.by((): Point | undefined => {
    if (!cursor) return undefined;
    return [cursor[0] * w, cursor[1] * h];
  });

  // ── Centroid (normalized) ─────────────────────────────────────────────
  let centroidN = $derived.by((): Point => {
    if (points.length === 0) return [0, 0];
    return centroidUtil(points);
  });

  let centroidPx = $derived.by((): Point => {
    if (points.length === 0) return [0, 0];
    return [centroidN[0] * w, centroidN[1] * h];
  });

  // ── Pan offset (normalized) ──────────────────────────────────────────
  //
  // The bbox <path> is visually rotated via CSS transform:
  //   style:transform="rotate({currentAngle()}rad)"
  //   style:transform-origin="{displayCentroid[0] * w}px {displayCentroid[1] * h}px"
  //
  // Because transform-origin follows the centroid (which includes the offset),
  // a simple screen-space delta added to all points produces the correct
  // visual translation — no inverse rotation needed.
  let panOffset = $derived.by((): Point => {
    if (panStart && cursorPx) {
      return [(cursorPx[0] - panStart[0]) / w, (cursorPx[1] - panStart[1]) / h];
    }
    return [0, 0];
  });

  // ── Display points ────────────────────────────────────────────────────
  let displayPoints = $derived.by((): Point[] => {
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      return points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]]) as Point[];
    }
    return points;
  });

  let displayCentroid = $derived.by((): Point => {
    if (displayPoints.length === 0) return [0, 0];
    return centroidUtil(displayPoints);
  });

  // ── SVG path (pixel space) ────────────────────────────────────────────
  let pathD = $derived.by(() => {
    if (displayPoints.length < 4) return "";
    return displayPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * w} ${p[1] * h}`).join(" ") + " Z";
  });

  // ── Resize effect ─────────────────────────────────────────────────────
  let lastResizeCursor: Point = $state([-1, -1]);

  $effect(() => {
    if (!cursorPx || resizeHandleIndex === undefined || resizeInitialPoints.length !== 4) return;
    if (cursorPx[0] === lastResizeCursor[0] && cursorPx[1] === lastResizeCursor[1]) return;
    lastResizeCursor = cursorPx;
    handleResize(resizeHandleIndex, cursorPx);
  });

  function currentAngle(): number {
    if (rotateStart && rotateStartAngle !== undefined && rotateStartRevolutions !== undefined && cursorPx) {
      const cp: Point = [centroidN[0] * w, centroidN[1] * h];
      const rel: Point = [cursorPx[0] - cp[0], cursorPx[1] - cp[1]];
      const cursorAngle = Math.atan2(rel[0], -rel[1]);
      return cursorAngle + rotateStartRevolutions * 2 * Math.PI;
    }
    return angle;
  }

  // ── Resize logic ──────────────────────────────────────────────────────
  function handleResize(handleIndex: number, cursorPosPx: Point) {
    if (resizeInitialPoints.length !== 4) return;

    const curAngle = currentAngle();
    const cursorN: Point = [cursorPosPx[0] / w, cursorPosPx[1] / h];
    const initCentroid = centroidUtil(resizeInitialPoints);

    const unrotatedCursor = inverseRotatePointN(cursorN, initCentroid, curAngle, w, h);

    const [tl, tr, br, bl] = resizeInitialPoints;

    let nx1 = tl[0],
      ny1 = tl[1],
      nx2 = br[0],
      ny2 = br[1];
    let fixedPoint: Point;

    if (handleIndex % 2 === 0) {
      const cornerIdx = handleIndex / 2;
      switch (cornerIdx) {
        case 0:
          nx1 = unrotatedCursor[0];
          ny1 = unrotatedCursor[1];
          fixedPoint = br;
          break;
        case 1:
          nx2 = unrotatedCursor[0];
          ny1 = unrotatedCursor[1];
          fixedPoint = bl;
          break;
        case 2:
          nx2 = unrotatedCursor[0];
          ny2 = unrotatedCursor[1];
          fixedPoint = tl;
          break;
        default:
          nx1 = unrotatedCursor[0];
          ny2 = unrotatedCursor[1];
          fixedPoint = tr;
          break;
      }
    } else {
      const edgeIdx = Math.floor(handleIndex / 2);
      switch (edgeIdx) {
        case 0:
          ny1 = unrotatedCursor[1];
          fixedPoint = [(tl[0] + br[0]) / 2, br[1]];
          break;
        case 1:
          nx2 = unrotatedCursor[0];
          fixedPoint = [tl[0], (tl[1] + br[1]) / 2];
          break;
        case 2:
          ny2 = unrotatedCursor[1];
          fixedPoint = [(tl[0] + br[0]) / 2, tl[1]];
          break;
        default:
          nx1 = unrotatedCursor[0];
          fixedPoint = [br[0], (tl[1] + br[1]) / 2];
          break;
      }
    }

    const newPts: Point[] = [
      [nx1, ny1],
      [nx2, ny1],
      [nx2, ny2],
      [nx1, ny2],
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

  // ── Emit complete ─────────────────────────────────────────────────────
  function emitComplete() {
    const pts = _localPoints ?? points;
    const ang = _localAngle ?? angle;
    if (pts.length < 4) return;
    onEditComplete?.(pts as Point[], { angle: ang });
  }

  // ── Selection API ─────────────────────────────────────────────────────
  const HANDLE_RADIUS_PX = 6;
  const ROTATE_RADIUS_PX = 7;
  const HANDLE_RADIUS_PX_SQR = HANDLE_RADIUS_PX * HANDLE_RADIUS_PX;
  const ROTATE_RADIUS_PX_SQR = ROTATE_RADIUS_PX * ROTATE_RADIUS_PX;

  export function startSelection(start: Point, _shiftKey?: boolean): boolean {
    if (!editable || points.length !== 4) return false;

    // Inverse-rotate the cursor so we can test against the unrotated AABB.
    // The visual bbox is rotated by `currentAngle()` around `centroidN`,
    // so we rotate the cursor in the opposite direction.
    const curAngle = currentAngle();
    const startRotated = curAngle !== 0 ? inverseRotatePointN(start, centroidN, curAngle, w, h) : start;

    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const isInside =
      startRotated[0] >= minX && startRotated[0] <= maxX && startRotated[1] >= minY && startRotated[1] <= maxY;
    if (!isInside) return false;

    const scale = viewport.workspace.transform.scale;

    // 1. Check resize handles (nearest-first)
    const handles = boundingBoxHandle(points);
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const dx = Math.abs(start[0] - handle[0]) * w * scale;
      const dy = Math.abs(start[1] - handle[1]) * h * scale;
      // If within handle radius, start resizing with this handle
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
      const allY = points.map((p) => p[1]);
      const allX = points.map((p) => p[0]);
      const minYVal = Math.min(...allY);
      const minXVal = Math.min(...allX);
      const maxXVal = Math.max(...allX);
      const topMidN: Point = [(minXVal + maxXVal) / 2, minYVal];
      const handleDist = 60;
      const handleOffset = handleDist / Math.max(w, h);
      const rotHandleN: Point = [topMidN[0], topMidN[1] - handleOffset];
      const rotHandleRotated = rotatePointN(rotHandleN, centroidN, currentAngle(), w, h);

      const rdx = Math.abs(start[0] - rotHandleRotated[0]) * w * scale;
      const rdy = Math.abs(start[1] - rotHandleRotated[1]) * h * scale;
      // If within rotation handle radius, start rotating with this handle as the pivot
      if (rdx * rdx + rdy * rdy < ROTATE_RADIUS_PX_SQR) {
        rotateStart = centroidN;
        rotateStartRevolutions = Math.round(currentAngle() / (2 * Math.PI));
        const cp: Point = [centroidN[0] * w, centroidN[1] * h];
        const rel: Point = [start[0] * w - cp[0], start[1] * h - cp[1]];
        rotateStartAngle = Math.atan2(rel[0], -rel[1]);
        activeCursor = rotateCursorSVG(color);
        return true;
      }
    }

    // 3. Bbox body → start pan
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
      if (_localPoints && _localPoints.length === 4) {
        _localPoints = normalizeRect(_localPoints);
        changed = true;
      }
      resizeHandleIndex = undefined;
      resizeInitialPoints = [];
      activeCursor = undefined;
    }
    if (changed) {
      emitComplete();
    }
    _localAngle = undefined;
    _localPoints = undefined;
  }

  // ── Cursor style for the shape body ──────────────────────────────────
  //   "cursor-grabbing"  → actively dragging (pan, resize, or rotate in progress)
  //   "cursor-grab"      → editable & selected (ready to start a drag)
  //   "cursor-pointer"   → otherwise
  //   "cursor-note"       → hovering in note mode
  let bodyCursor = $derived(
    mode === "note" ? "cursor-note" :
    isEditing ? "cursor-grabbing" :
    editable && selected ? "cursor-grab" :
    "cursor-pointer"
  );

  // ── Hover state for body cursor ───────────────────────────────────────
  let over = $state(false);
</script>

{#if pathD}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <path
    d={pathD}
    fill={color}
    fill-opacity={selected ? 0.6 : 0.3}
    stroke={color.replace("0.5", "1")}
    stroke-width={selected ? 1.5 : 1}
    style:transform-origin="{displayCentroid[0] * w}px {displayCentroid[1] * h}px"
    style:transform="rotate({currentAngle()}rad)"
    vector-effect="non-scaling-stroke"
    style={shapeStyleString}
    onmouseenter={() => (over = true)}
    onmouseleave={() => (over = false)}
    class={bodyCursor}
    style:outline="none"
    role="button"
    tabindex="-1"
    onclick={onClick}
    onmousedown={(e) => {
      // Do not start selection if in creation mode,
      // to avoid interfering with the creation process
      if (viewport.isCreationMode) return;

      // In review mode, let the event bubble for panning
      if (viewport.mode === "review") return;

      if (editable && selected && cursor) {
        startSelection(cursor);
      }
      e.stopPropagation();
    }}
  />

  {#if editable && selected && !isEditing && displayPoints.length === 4}
    <BBoxHandler
      {displayPoints}
      {centroidN}
      {centroidPx}
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
