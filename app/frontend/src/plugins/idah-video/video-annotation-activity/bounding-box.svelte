<script lang="ts">
  import { IDAH_NOTE } from "../type";
  import { X, Y, type Point } from "./VideoAnnotationContext";

  let {
    ratio = [1, 1],
    offset = [0, 0],
    points: initialPoints,
    angle = 0,
    editable = false,
    cursor,
    color = "rgba(246, 64, 43, 0.5)",
    mode,
    onChange,
    onmousedown,
    pointer,
    onEditingChange,
  }: {
    ratio: Point;
    offset: Point;
    points: Point[];
    angle: number;
    editable?: boolean;
    cursor?: Point;
    color?: string;
    mode: string;
    onmousedown?: (e: MouseEvent) => void;
    onChange?: (bb: Point[], angle: number) => void;
    pointer: string;
    onEditingChange?: (isEditing: boolean) => void;
  } = $props();

  export interface ToolSelection {
    startSelection: (start: Point) => void;
    endSelection: (end: Point) => void;
  }

  let points: Point[] = $state(initialPoints);
  let panStart: Point | undefined = $state();
  let initialPanPoints: Point[] = $state([]);
  let rotateStart: Point | undefined = $state();
  let rotateStartAngle: number | undefined = $state();
  let resizeHandleIndex: number | undefined = $state();
  let activeCursor: string | undefined = $state();

  // Revolution counter - derived from the stored angle
  let revolutionCount = $derived(Math.round(angle / (2 * Math.PI)));

  // Store the revolution count when rotation starts to preserve it
  let rotateStartRevolutions: number | undefined = $state();

  // Sync initialPoints when not editing
  $effect(() => {
    const newPoints = initialPoints;

    // Only update if not currently editing
    if (!panStart && !rotateStart && resizeHandleIndex === undefined) {
      points = [...newPoints];
    }
  });

  let cursor_pixel: Point = $derived.by(() => {
    if (!cursor) return [0, 0];
    return [cursor[X] * ratio[X], cursor[Y] * ratio[Y]];
  });

  let centroid: Point = $derived.by(() => {
    if (points.length === 0) return [0, 0];
    return getCentroid(points);
  });

  // Calculate pan offset for rendering
  let panOffset: Point = $derived.by(() => {
    if (panStart && cursor_pixel) {
      return [(cursor_pixel[X] - panStart[X]) / ratio[X], (cursor_pixel[Y] - panStart[Y]) / ratio[Y]];
    }
    return [0, 0];
  });

  let isEditing = $derived.by(() => {
    return editable && (!!panStart || !!rotateStart || resizeHandleIndex !== undefined || points.length < 4);
  });

  $effect(() => {
    onEditingChange?.(isEditing);
  });

  // Update points based on cursor movement (pan)
  let updatedPoints = $derived.by(() => {
    if (panOffset[X] !== 0 || panOffset[Y] !== 0) {
      return points.map((p) => [p[X] + panOffset[X], p[Y] + panOffset[Y]]) as Point[];
    }
    return points;
  });

  // Generate preview points while drawing, or use updatedPoints during operations
  let displayPoints = $derived.by(() => {
    if (points.length === 1 && cursor) {
      // Show live preview of rectangle while drawing
      const topLeft: Point = [Math.min(points[0][X], cursor[X]), Math.min(points[0][Y], cursor[Y])];
      const bottomRight: Point = [Math.max(points[0][X], cursor[X]), Math.max(points[0][Y], cursor[Y])];

      return [topLeft, [bottomRight[X], topLeft[Y]], bottomRight, [topLeft[X], bottomRight[Y]]];
    }
    // Use updatedPoints (which handles pan) for display
    return updatedPoints;
  });

  // Track last cursor for resize to prevent infinite loops
  let lastResizeCursor: Point = $state([0, 0]);

  $effect(() => {
    const currentCursor = cursor_pixel;

    if (points.length === 4 && resizeHandleIndex !== undefined) {
      // Only update if cursor actually moved
      if (currentCursor[X] !== lastResizeCursor[X] || currentCursor[Y] !== lastResizeCursor[Y]) {
        lastResizeCursor = currentCursor;
        handleResize(resizeHandleIndex, currentCursor);
      }
    }
  });

  function draw_cmd(path: Point[]) {
    if (path.length === 0) return "";
    return [...path.map((p, i) => `${i === 0 ? "M" : "L"}${p[X] * ratio[X]} ${p[Y] * ratio[Y]}`), "Z"].join(" ");
  }

  // Derive the centroid with pan offset applied for rendering rotation handle
  let displayCentroid: Point = $derived.by(() => {
    if (updatedPoints.length === 0) return [0, 0];
    return getCentroid(updatedPoints);
  });

  function getCentroid(pts: Point[]): Point {
    if (pts.length === 0) return [0, 0];
    return pts.reduce((acc, p) => [acc[X] + p[X], acc[Y] + p[Y]], [0, 0]).map((c) => c / pts.length) as Point;
  }

  function rotatePoint(point: Point, center: Point, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point[X] - center[X];
    const dy = point[Y] - center[Y];
    return [center[X] + dx * cos - dy * sin, center[Y] + dx * sin + dy * cos];
  }

  // Rotation in normalized space (accounting for non-uniform scaling)
  function rotatePointNormalized(point: Point, center: Point, angle: number, ratio: Point): Point {
    // Convert to pixel space
    const pointPixel: Point = [point[X] * ratio[X], point[Y] * ratio[Y]];
    const centerPixel: Point = [center[X] * ratio[X], center[Y] * ratio[Y]];

    // Rotate in pixel space
    const rotated = rotatePoint(pointPixel, centerPixel, angle);

    // Convert back to normalized space
    return [rotated[X] / ratio[X], rotated[Y] / ratio[Y]];
  }

  function inverseRotatePointNormalized(point: Point, center: Point, angle: number, ratio: Point): Point {
    return rotatePointNormalized(point, center, -angle, ratio);
  }

  function get_angle(): number {
    if (rotateStart && cursor_pixel && rotateStartAngle !== undefined && rotateStartRevolutions !== undefined) {
      // Calculate angle directly in PIXEL space (not normalized)
      // This matches the visual rotation which happens in screen/pixel space
      const centroidPixel: Point = [centroid[X] * ratio[X], centroid[Y] * ratio[Y]];

      const rel: Point = [cursor_pixel[X] - centroidPixel[X], cursor_pixel[Y] - centroidPixel[Y]];

      // Measure angle from north (up), clockwise: atan2(X, -Y)
      const currentCursorAngle = Math.atan2(rel[X], -rel[Y]);

      // Preserve the revolution count by adding it back
      return currentCursorAngle + rotateStartRevolutions * 2 * Math.PI;
    } else {
      return angle;
    }
  }

  export function startSelection(start: Point) {
    if (points.length === 0) {
      points = [start];
    }
  }

  export function endSelection(end: Point) {
    if (points.length === 1) {
      // Create a proper rectangle from two diagonal corners
      const topLeft: Point = [Math.min(points[0][X], end[X]), Math.min(points[0][Y], end[Y])];
      const bottomRight: Point = [Math.max(points[0][X], end[X]), Math.max(points[0][Y], end[Y])];

      // Create rectangle: top-left, top-right, bottom-right, bottom-left
      points = [topLeft, [bottomRight[X], topLeft[Y]], bottomRight, [topLeft[X], bottomRight[Y]]];
      onChange?.(points, angle);
    } else if (points.length === 4) {
      if (panStart) {
        onChange?.(updatedPoints, angle);
        points = updatedPoints;
        panStart = undefined;
        initialPanPoints = [];
      }
      if (rotateStart) {
        angle = get_angle();
        onChange?.(points, angle);
        rotateStart = undefined;
        rotateStartAngle = undefined;
        rotateStartRevolutions = undefined;
        activeCursor = undefined;
      }
      if (resizeHandleIndex !== undefined) {
        onChange?.(points, angle);
        resizeHandleIndex = undefined;
        activeCursor = undefined;
      }
    }
  }

  function incrementRevolution() {
    const newAngle = angle + 2 * Math.PI;
    onChange?.(points, newAngle);
  }

  function decrementRevolution() {
    const newAngle = angle - 2 * Math.PI;
    onChange?.(points, newAngle);
  }

  // Get cursor type based on handle index
  function getHandleCursor(handle_index: number): string {
    const cursors = [
      "nwse-resize",
      "ns-resize",
      "nesw-resize",
      "ew-resize",
      "nwse-resize",
      "ns-resize",
      "nesw-resize",
      "ew-resize",
    ];
    return cursors[handle_index] || "grab";
  }

  // Generate SVG cursor for a specific resize handle that rotates with the bounding box
  function getRotatedCursorSVG(handle_index: number): string {
    const currentAngle = get_angle();
    const cursorType = getHandleCursor(handle_index);
    const angleDeg = (currentAngle * 180) / Math.PI;

    // Map cursor types to their base SVG paths
    const cursorSVGs: Record<string, string> = {
      "nwse-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M8 8L4 4M4 4H8M4 4V8" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 16L20 20M20 20H16M20 20V16" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "nesw-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M16 8L20 4M20 4H16M20 4V8" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 16L4 20M4 20H8M4 20V16" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "ns-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M12 4V20M12 4L9 7M12 4L15 7M12 20L9 17M12 20L15 17" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "ew-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M4 12H20M4 12L7 9M4 12L7 15M20 12L17 9M20 12L17 15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
    };

    const svgString = cursorSVGs[cursorType] || cursorSVGs["nwse-resize"];
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
  }

  function getCursor() {
    if (isEditing) return "none";
    if (mode === IDAH_NOTE) return "cursor-note";
    return pointer;
  }

  function boundingBoxHandle(p: Point[]): Point[] {
    if (p.length !== 4) return [];
    const handles: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      handles.push(p[i]); // Corner handle
      handles.push([(p[i][X] + p[next][X]) / 2, (p[i][Y] + p[next][Y]) / 2]); // Edge handle
    }
    return handles;
  }

  function handleResize(handleIndex: number, cursorPos: Point) {
    if (points.length !== 4) return;

    const currentAngle = get_angle();
    const cursorNormalized: Point = [cursorPos[X] / ratio[X], cursorPos[Y] / ratio[Y]];

    // Capture the current centroid and points before any changes
    const oldCentroid = $state.snapshot(centroid) as Point;
    const oldPoints = [...points];

    // Transform cursor to unrotated normalized space
    const unrotatedCursor = inverseRotatePointNormalized(cursorNormalized, oldCentroid, currentAngle, ratio);

    // These will be our new bounds (can flip)
    let pt0X: number, pt0Y: number; // top-left
    let pt1X: number, pt1Y: number; // top-right
    let pt2X: number, pt2Y: number; // bottom-right
    let pt3X: number, pt3Y: number; // bottom-left

    // Determine which corner/edge should stay fixed IN SCREEN SPACE
    let fixedPoint: Point;

    // Handle corner resizing (even indices)
    if (handleIndex % 2 === 0) {
      const cornerIndex = handleIndex / 2;
      const fixedPointIndex = (cornerIndex + 2) % 4; // opposite corner in current configuration

      // Get the fixed point BEFORE any flipping
      fixedPoint = oldPoints[fixedPointIndex];

      // Build the rectangle by setting cursor and fixed points directly
      // This allows natural flipping
      switch (cornerIndex) {
        case 0: // dragging top-left (fix bottom-right)
          pt0X = unrotatedCursor[X];
          pt0Y = unrotatedCursor[Y]; // dragged corner
          pt1X = fixedPoint[X];
          pt1Y = unrotatedCursor[Y]; // top-right
          pt2X = fixedPoint[X];
          pt2Y = fixedPoint[Y]; // fixed corner
          pt3X = unrotatedCursor[X];
          pt3Y = fixedPoint[Y]; // bottom-left
          break;
        case 1: // dragging top-right (fix bottom-left)
          pt0X = fixedPoint[X];
          pt0Y = unrotatedCursor[Y]; // top-left
          pt1X = unrotatedCursor[X];
          pt1Y = unrotatedCursor[Y]; // dragged corner
          pt2X = unrotatedCursor[X];
          pt2Y = fixedPoint[Y]; // bottom-right
          pt3X = fixedPoint[X];
          pt3Y = fixedPoint[Y]; // fixed corner
          break;
        case 2: // dragging bottom-right (fix top-left)
          pt0X = fixedPoint[X];
          pt0Y = fixedPoint[Y]; // fixed corner
          pt1X = unrotatedCursor[X];
          pt1Y = fixedPoint[Y]; // top-right
          pt2X = unrotatedCursor[X];
          pt2Y = unrotatedCursor[Y]; // dragged corner
          pt3X = fixedPoint[X];
          pt3Y = unrotatedCursor[Y]; // bottom-left
          break;
        case 3: // dragging bottom-left (fix top-right)
          pt0X = unrotatedCursor[X];
          pt0Y = fixedPoint[Y]; // top-left
          pt1X = fixedPoint[X];
          pt1Y = fixedPoint[Y]; // fixed corner
          pt2X = fixedPoint[X];
          pt2Y = unrotatedCursor[Y]; // bottom-right
          pt3X = unrotatedCursor[X];
          pt3Y = unrotatedCursor[Y]; // dragged corner
          break;
      }
    }
    // Handle edge resizing (odd indices) - FIXED VERSION WITH CROSSING
    else {
      const edgeIndex = Math.floor(handleIndex / 2);

      // Calculate current geometric bounds from old points
      const geoMinX = Math.min(oldPoints[0][X], oldPoints[1][X], oldPoints[2][X], oldPoints[3][X]);
      const geoMaxX = Math.max(oldPoints[0][X], oldPoints[1][X], oldPoints[2][X], oldPoints[3][X]);
      const geoMinY = Math.min(oldPoints[0][Y], oldPoints[1][Y], oldPoints[2][Y], oldPoints[3][Y]);
      const geoMaxY = Math.max(oldPoints[0][Y], oldPoints[1][Y], oldPoints[2][Y], oldPoints[3][Y]);

      switch (edgeIndex) {
        case 0: {
          // Started dragging top edge
          const oppositeY = geoMaxY; // bottom edge Y

          pt0X = geoMinX;
          pt0Y = unrotatedCursor[Y];
          pt1X = geoMaxX;
          pt1Y = unrotatedCursor[Y];
          pt2X = geoMaxX;
          pt2Y = oppositeY;
          pt3X = geoMinX;
          pt3Y = oppositeY;

          // Fixed point is the opposite edge center
          fixedPoint = [(geoMinX + geoMaxX) / 2, oppositeY];
          break;
        }

        case 1: {
          // Started dragging right edge
          const oppositeX = geoMinX; // left edge X

          pt0X = oppositeX;
          pt0Y = geoMinY;
          pt1X = unrotatedCursor[X];
          pt1Y = geoMinY;
          pt2X = unrotatedCursor[X];
          pt2Y = geoMaxY;
          pt3X = oppositeX;
          pt3Y = geoMaxY;

          fixedPoint = [oppositeX, (geoMinY + geoMaxY) / 2];
          break;
        }

        case 2: {
          // Started dragging bottom edge
          const oppositeY = geoMinY; // top edge Y

          pt0X = geoMinX;
          pt0Y = oppositeY;
          pt1X = geoMaxX;
          pt1Y = oppositeY;
          pt2X = geoMaxX;
          pt2Y = unrotatedCursor[Y];
          pt3X = geoMinX;
          pt3Y = unrotatedCursor[Y];

          fixedPoint = [(geoMinX + geoMaxX) / 2, oppositeY];
          break;
        }

        case 3: {
          // Started dragging left edge
          const oppositeX = geoMaxX; // right edge X

          pt0X = unrotatedCursor[X];
          pt0Y = geoMinY;
          pt1X = oppositeX;
          pt1Y = geoMinY;
          pt2X = oppositeX;
          pt2Y = geoMaxY;
          pt3X = unrotatedCursor[X];
          pt3Y = geoMaxY;

          fixedPoint = [oppositeX, (geoMinY + geoMaxY) / 2];
          break;
        }
      }
    }

    // Create new rectangular box - keep raw coordinates to allow flipping
    let newUnrotatedPoints: Point[] = [
      [pt0X, pt0Y], // top-left
      [pt1X, pt1Y], // top-right
      [pt2X, pt2Y], // bottom-right
      [pt3X, pt3Y], // bottom-left
    ];

    // Calculate new centroid
    const newCentroid = getCentroid(newUnrotatedPoints);

    // Calculate where the fixed point would be in screen space after rotation
    const oldFixedRotated = rotatePointNormalized(fixedPoint, oldCentroid, currentAngle, ratio);

    // For edge resizing, calculate where the fixed point is in the new geometry
    let newFixedPoint: Point;
    if (handleIndex % 2 === 0) {
      // Corner resize: the fixed point stays at its original coordinates
      newFixedPoint = fixedPoint;
    } else {
      // Edge resize: the fixed point stays at the same position (opposite edge center)
      newFixedPoint = fixedPoint;
    }

    const newFixedRotated = rotatePointNormalized(newFixedPoint, newCentroid, currentAngle, ratio);

    // Calculate the shift needed to keep fixed point stationary
    const fixedPointShift: Point = [oldFixedRotated[X] - newFixedRotated[X], oldFixedRotated[Y] - newFixedRotated[Y]];

    // Apply shift to all points
    newUnrotatedPoints = newUnrotatedPoints.map((p) => [
      p[X] + fixedPointShift[X],
      p[Y] + fixedPointShift[Y],
    ]) as Point[];

    points = newUnrotatedPoints;
  }

  // Create SVG cursor for rotation handle with curved arrows
  function getRotateCursorSVG(): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3456 3 16.4922 3.93392 18.1243 5.43938" 
              stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M17 3L18.1243 5.43938L15.5 6.5" 
              stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${color}"/>
        <circle cx="12" cy="12" r="2" fill="${color}"/>
      </svg>
    `)}`;
  }
</script>

<g transform={`translate(${offset[X]}, ${offset[Y]})`}>
  <!-- Bounding Box -->
  {#if displayPoints.length > 0}
    <path
      d={draw_cmd(displayPoints)}
      style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
      style:transform={`rotate(${get_angle()}rad)`}
      vector-effect="non-scaling-stroke"
      class={getCursor()}
      fill-opacity="0.4"
      style:fill={color}
      style:stroke={color}
      style:stroke-width="2"
      onmousedown={(e) => {
        onmousedown?.(e);
        if (editable && points.length === 4 && !panStart && !rotateStart && resizeHandleIndex === undefined) {
          e.stopPropagation();
          panStart = cursor_pixel;
          initialPanPoints = [...points];
        }
      }}
    />

    <!-- Bounding Box Handles -->
    {#if editable && points.length === 4}
      <!-- Debug: Show line from centroid to cursor when rotating -->
      {#if rotateStart && cursor_pixel}
        <line
          x1={displayCentroid[X] * ratio[X]}
          y1={displayCentroid[Y] * ratio[Y]}
          x2={cursor_pixel[X]}
          y2={cursor_pixel[Y]}
          stroke={color}
          stroke-width="2"
          stroke-dasharray="5,5"
        />
        <circle
          cx={displayCentroid[X] * ratio[X]}
          cy={displayCentroid[Y] * ratio[Y]}
          r={4}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${get_angle()}rad)`}
          vector-effect="non-scaling-stroke"
          style:stroke={color}
          style:fill={color}
          style:opacity="0.5"
        />
      {/if}

      <!-- Rotation handle (above top edge) -->
      {#if editable && points.length === 4}
        {@const minY = Math.min(updatedPoints[0][Y], updatedPoints[1][Y], updatedPoints[2][Y], updatedPoints[3][Y])}
        {@const maxY = Math.max(updatedPoints[0][Y], updatedPoints[1][Y], updatedPoints[2][Y], updatedPoints[3][Y])}
        {@const minX = Math.min(updatedPoints[0][X], updatedPoints[1][X], updatedPoints[2][X], updatedPoints[3][X])}
        {@const maxX = Math.max(updatedPoints[0][X], updatedPoints[1][X], updatedPoints[2][X], updatedPoints[3][X])}

        <!-- Top edge is the edge with minY (smallest Y = topmost in unrotated space) -->
        {@const topEdgeMidpoint = [(minX + maxX) / 2, minY]}
        {@const handleDistance = 60}
        <!-- pixels above the top edge -->
        {@const handleOffset = handleDistance / Math.max(ratio[X], ratio[Y])}
        <!-- convert to normalized space -->

        <line
          x1={topEdgeMidpoint[X] * ratio[X]}
          y1={topEdgeMidpoint[Y] * ratio[Y]}
          x2={topEdgeMidpoint[X] * ratio[X]}
          y2={(topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}
          stroke={color}
          stroke-width="2"
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${get_angle()}rad)`}
          pointer-events="none"
        />

        <!-- Rotation handle circle with custom cursor -->
        <circle
          onmousedown={(e) => {
            if (!panStart && !rotateStart && resizeHandleIndex === undefined) {
              e.stopPropagation();
              rotateStart = centroid;
              rotateStartRevolutions = revolutionCount;
              activeCursor = getRotateCursorSVG();

              // Calculate angle in pixel space
              const centroidPixel: Point = [displayCentroid[X] * ratio[X], displayCentroid[Y] * ratio[Y]];
              const rel: Point = [cursor_pixel[X] - centroidPixel[X], cursor_pixel[Y] - centroidPixel[Y]];
              rotateStartAngle = Math.atan2(rel[X], -rel[Y]);
            }
            onmousedown?.(e);
          }}
          cx={topEdgeMidpoint[X] * ratio[X]}
          cy={(topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}
          r={6}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${get_angle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotateCursorSVG()}') 12 12, grab`}
          style:fill={color}
        />

        <!-- Revolution counter (not rotated, always horizontal) -->
        {@const handleX = topEdgeMidpoint[X] * ratio[X]}
        {@const handleY = (topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}

        <!-- Calculate rotated position of handle in screen space -->
        {@const centroidPixelX = displayCentroid[X] * ratio[X]}
        {@const centroidPixelY = displayCentroid[Y] * ratio[Y]}
        {@const currentAngle = get_angle()}
        {@const dx = handleX - centroidPixelX}
        {@const dy = handleY - centroidPixelY}
        {@const cos = Math.cos(currentAngle)}
        {@const sin = Math.sin(currentAngle)}
        {@const rotatedHandleX = centroidPixelX + dx * cos - dy * sin}
        {@const rotatedHandleY = centroidPixelY + dx * sin + dy * cos}

        {@const buttonRadius = 7}
        {@const buttonSpacing = 20}

        <!-- Decrement button (left) -->
        <line
          x1={rotatedHandleX - buttonSpacing - buttonRadius}
          y1={rotatedHandleY}
          x2={rotatedHandleX - buttonSpacing + buttonRadius}
          y2={rotatedHandleY}
          filter={"brightness(100%)"}
          stroke={color}
          stroke-width="2"
        />
        <circle
          cx={rotatedHandleX - buttonSpacing}
          cy={rotatedHandleY}
          r={buttonRadius}
          style:fill={color}
          fill-opacity="1%"
          style:cursor="pointer"
          onmousedown={(e) => {
            e.stopPropagation();
            decrementRevolution();
            onmousedown?.(e);
          }}
        />
        <!-- Degree angle display -->
        <text
          x={rotatedHandleX}
          y={rotatedHandleY - 20}
          text-anchor="middle"
          dominant-baseline="central"
          style:font-size="11px"
          style:font-weight="bold"
          style:fill={color}
          style:pointer-events="none"
          style:user-select="none"
        >
          {(get_angle() * (180 / Math.PI)).toFixed(1)}°
        </text>

        <!-- Increment button (right) -->
        <line
          x1={rotatedHandleX + buttonSpacing - buttonRadius}
          y1={rotatedHandleY}
          x2={rotatedHandleX + buttonSpacing + buttonRadius}
          y2={rotatedHandleY}
          filter={"brightness(100%)"}
          stroke={color}
          stroke-width="2"
        />
        <line
          x1={rotatedHandleX + buttonSpacing}
          y1={rotatedHandleY - buttonRadius}
          x2={rotatedHandleX + buttonSpacing}
          y2={rotatedHandleY + buttonRadius}
          filter={"brightness(100%)"}
          stroke={color}
          stroke-width="2"
        />
        <circle
          cx={rotatedHandleX + buttonSpacing}
          cy={rotatedHandleY}
          r={buttonRadius}
          style:fill={color}
          fill-opacity="1%"
          style:cursor="pointer"
          onmousedown={(e) => {
            e.stopPropagation();
            incrementRevolution();
            onmousedown?.(e);
          }}
        />
      {/if}

      <!-- Resize handles with rotated cursors -->
      {#each boundingBoxHandle(updatedPoints) as point, handle (handle)}
        <circle
          onmousedown={(e) => {
            e.stopPropagation();
            if (!panStart && !rotateStart && resizeHandleIndex === undefined) {
              resizeHandleIndex = handle;
              activeCursor = getRotatedCursorSVG(handle);
            }
            onmousedown?.(e);
          }}
          cx={point[X] * ratio[X]}
          cy={point[Y] * ratio[Y]}
          r={5}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${get_angle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotatedCursorSVG(handle)}') 12 12, ${getHandleCursor(handle)}`}
          vector-effect="non-scaling-stroke"
          style:stroke={color}
          style:fill={color}
        />
      {/each}
    {/if}
  {/if}

  <!-- Active cursor overlay that persists during drag operations/need -->
  {#if activeCursor && cursor_pixel}
    <g style="pointer-events: none;">
      <image href={activeCursor} x={cursor_pixel[X] - 21} y={cursor_pixel[Y] - 21} width="42" height="42" />
    </g>
  {/if}
</g>
