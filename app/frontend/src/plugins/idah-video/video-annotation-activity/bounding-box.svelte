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
    onEditingChange,
    onPointerChange,
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
    onEditingChange?: (isEditing: boolean) => void;
    onPointerChange?: (pointer: string | undefined) => void;
  } = $props();

  export interface ToolSelection {
    startSelection: (start: Point) => void;
    endSelection: (end: Point) => void;
  }

  let points: Point[] = $state(initialPoints);
  let panStart: Point | undefined = $state();
  let rotateStart: Point | undefined = $state();
  let rotateStartAngle: number | undefined = $state();
  let resizeHandleIndex: number | undefined = $state();
  let resizeInitialPoints: Point[] = $state([]);
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
  $effect(() => {
    onPointerChange?.(edition_cursor);
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

  function getAngle(): number {
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
      }
      if (rotateStart) {
        angle = getAngle();
        onChange?.(points, angle);
        rotateStart = undefined;
        rotateStartAngle = undefined;
        rotateStartRevolutions = undefined;
        activeCursor = undefined;
      }
      if (resizeHandleIndex !== undefined) {
        // Normalize points before saving to ensure consistent interpolation
        const normalizedPoints = normalizePoints(points);
        onChange?.(normalizedPoints, angle);
        points = normalizedPoints;
        resizeHandleIndex = undefined;
        resizeInitialPoints = [];
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

  // Normalize points to canonical order for consistent interpolation
  function normalizePoints(pts: Point[]): Point[] {
    if (pts.length !== 4) return pts;

    // Find min/max coordinates
    const minX = Math.min(pts[0][X], pts[1][X], pts[2][X], pts[3][X]);
    const maxX = Math.max(pts[0][X], pts[1][X], pts[2][X], pts[3][X]);
    const minY = Math.min(pts[0][Y], pts[1][Y], pts[2][Y], pts[3][Y]);
    const maxY = Math.max(pts[0][Y], pts[1][Y], pts[2][Y], pts[3][Y]);

    // Return in canonical order: top-left, top-right, bottom-right, bottom-left
    return [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ];
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
    const currentAngle = getAngle();
    const cursorType = getHandleCursor(handle_index);
    const angleDeg = (currentAngle * 180) / Math.PI;

    // Map cursor types to their base SVG paths
    const cursorSVGs: Record<string, string> = {
      "nwse-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M8 8L4 4M4 4H8M4 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 16L20 20M20 20H16M20 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "nesw-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M16 8L20 4M20 4H16M20 4V8" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 16L4 20M4 20H8M4 20V16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "ns-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M12 4V20M12 4L9 7M12 4L15 7M12 20L9 17M12 20L15 17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
      "ew-resize": `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
          <g transform="rotate(${angleDeg} 12 12)">
            <path d="M4 12H20M4 12L7 9M4 12L7 15M20 12L17 9M20 12L17 15" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `,
    };

    const svgString = cursorSVGs[cursorType] || cursorSVGs["nwse-resize"];
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
  }

  let edition_cursor = $derived.by(() => {
    if (isEditing) return "cursor-none";
    if (mode === IDAH_NOTE) return "cursor-note";
    if (over) return editable ? "cursor-grab" : "cursor-pointer";
  });

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
    if (points.length !== 4 || resizeInitialPoints.length !== 4) return;

    const currentAngle = getAngle();
    const cursorNormalized: Point = [cursorPos[X] / ratio[X], cursorPos[Y] / ratio[Y]];

    // IMPORTANT: Points are stored in UNROTATED space
    // The visual rotation is applied via CSS transform
    // So we work entirely in unrotated space here

    // Get the centroid of the INITIAL points (when resize started)
    const initialCentroid = getCentroid(resizeInitialPoints);

    // Transform cursor from screen space to unrotated space
    const unrotatedCursor = inverseRotatePointNormalized(cursorNormalized, initialCentroid, currentAngle, ratio);

    // Initial points are already in unrotated space (that's how they're stored)
    const initialTopLeft = resizeInitialPoints[0];
    const initialTopRight = resizeInitialPoints[1];
    const initialBottomRight = resizeInitialPoints[2];
    const initialBottomLeft = resizeInitialPoints[3];

    // Define new bounds starting from initial
    let newTopLeftX = initialTopLeft[X];
    let newTopLeftY = initialTopLeft[Y];
    let newBottomRightX = initialBottomRight[X];
    let newBottomRightY = initialBottomRight[Y];

    // Determine which point/edge to keep fixed (in unrotated space)
    let fixedPointUnrotated: Point;

    // Handle corner resizing (even indices)
    if (handleIndex % 2 === 0) {
      const cornerIndex = handleIndex / 2;

      switch (cornerIndex) {
        case 0: // top-left corner
          newTopLeftX = unrotatedCursor[X];
          newTopLeftY = unrotatedCursor[Y];
          fixedPointUnrotated = initialBottomRight;
          break;
        case 1: // top-right corner
          newBottomRightX = unrotatedCursor[X];
          newTopLeftY = unrotatedCursor[Y];
          fixedPointUnrotated = initialBottomLeft;
          break;
        case 2: // bottom-right corner
          newBottomRightX = unrotatedCursor[X];
          newBottomRightY = unrotatedCursor[Y];
          fixedPointUnrotated = initialTopLeft;
          break;
        case 3: // bottom-left corner
          newTopLeftX = unrotatedCursor[X];
          newBottomRightY = unrotatedCursor[Y];
          fixedPointUnrotated = initialTopRight;
          break;
      }
    }
    // Handle edge resizing (odd indices)
    else {
      const edgeIndex = Math.floor(handleIndex / 2);

      switch (edgeIndex) {
        case 0: // top edge
          newTopLeftY = unrotatedCursor[Y];
          fixedPointUnrotated = [(initialTopLeft[X] + initialBottomRight[X]) / 2, initialBottomRight[Y]];
          break;
        case 1: // right edge
          newBottomRightX = unrotatedCursor[X];
          fixedPointUnrotated = [initialTopLeft[X], (initialTopLeft[Y] + initialBottomRight[Y]) / 2];
          break;
        case 2: // bottom edge
          newBottomRightY = unrotatedCursor[Y];
          fixedPointUnrotated = [(initialTopLeft[X] + initialBottomRight[X]) / 2, initialTopLeft[Y]];
          break;
        case 3: // left edge
          newTopLeftX = unrotatedCursor[X];
          fixedPointUnrotated = [initialBottomRight[X], (initialTopLeft[Y] + initialBottomRight[Y]) / 2];
          break;
      }
    }

    // Build new rectangle in unrotated space
    // Keep the raw coordinates to allow visual crossing during drag
    const newUnrotatedPoints: Point[] = [
      [newTopLeftX, newTopLeftY],
      [newBottomRightX, newTopLeftY],
      [newBottomRightX, newBottomRightY],
      [newTopLeftX, newBottomRightY],
    ];

    // Now we need to position the new rectangle so the fixed point stays in the same screen location
    // 1. Where was the fixed point in screen space?
    const fixedPointScreen = rotatePointNormalized(fixedPointUnrotated, initialCentroid, currentAngle, ratio);

    // 2. In the new rectangle, where is the fixed point?
    let newFixedPointUnrotated: Point;
    if (handleIndex % 2 === 0) {
      const cornerIndex = handleIndex / 2;
      const oppositeCorner = (cornerIndex + 2) % 4;
      newFixedPointUnrotated = newUnrotatedPoints[oppositeCorner];
    } else {
      const edgeIndex = Math.floor(handleIndex / 2);
      const oppositeEdge = (edgeIndex + 2) % 4;
      const nextCorner = (oppositeEdge + 1) % 4;
      newFixedPointUnrotated = [
        (newUnrotatedPoints[oppositeEdge][X] + newUnrotatedPoints[nextCorner][X]) / 2,
        (newUnrotatedPoints[oppositeEdge][Y] + newUnrotatedPoints[nextCorner][Y]) / 2,
      ];
    }

    // 3. If we rotate the new rectangle around its current centroid, where would the fixed point be?
    const newCentroid = getCentroid(newUnrotatedPoints);
    const newFixedPointScreen = rotatePointNormalized(newFixedPointUnrotated, newCentroid, currentAngle, ratio);

    // 4. Calculate the difference
    const shiftX = fixedPointScreen[X] - newFixedPointScreen[X];
    const shiftY = fixedPointScreen[Y] - newFixedPointScreen[Y];

    // 5. Shift all points (in unrotated space) to compensate
    points = newUnrotatedPoints.map((p) => [p[X] + shiftX, p[Y] + shiftY]) as Point[];
  }

  // Create SVG cursor for rotation handle with curved arrows
  function getRotateCursorSVG(): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none">
        <g transform="scale(0.75) translate(3, 3)">
          <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3456 3 16.4922 3.93392 18.1243 5.43938" 
                stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <path d="M17 3L18.1243 5.43938L15.5 6.5"
                stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${color}"/>
          <circle cx="12" cy="12" r="2" fill="${color}"/>
        </g>
      </svg>
    `)}`;
  }

  let over = $state(false);
</script>

<g transform={`translate(${offset[X]}, ${offset[Y]})`}>
  <!-- Bounding Box -->
  {#if displayPoints.length > 0}
    <!-- 
      NOTE:: Don't add role & tabindex props
      as it will have an focus ring when drag or mouse down on bounding box
    -->
    <path
      d={draw_cmd(displayPoints)}
      onmouseenter={() => (over = true)}
      onmouseleave={() => (over = false)}
      style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
      style:transform={`rotate(${getAngle()}rad)`}
      vector-effect="non-scaling-stroke"
      class={isEditing ? "cursor-none" : edition_cursor}
      fill-opacity="0.4"
      style:fill={color}
      style:stroke={color}
      style:stroke-width="2"
      onmousedown={(e) => {
        onmousedown?.(e);
        if (editable && points.length === 4 && !panStart && !rotateStart && resizeHandleIndex === undefined) {
          e.stopPropagation();
          panStart = cursor_pixel;
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
          style:transform={`rotate(${getAngle()}rad)`}
          vector-effect="non-scaling-stroke"
          style:stroke={color}
          style:fill={color}
          style:opacity="0.5"
        />
      {/if}

      <!-- Rotation handle (above top edge) -->
      {#if editable && points.length === 4}
        {@const minY = Math.min(updatedPoints[0][Y], updatedPoints[1][Y], updatedPoints[2][Y], updatedPoints[3][Y])}
        {@const minX = Math.min(updatedPoints[0][X], updatedPoints[1][X], updatedPoints[2][X], updatedPoints[3][X])}
        {@const maxX = Math.max(updatedPoints[0][X], updatedPoints[1][X], updatedPoints[2][X], updatedPoints[3][X])}

        {@const topEdgeMidpoint = [(minX + maxX) / 2, minY]}
        {@const handleDistance = 60}
        {@const handleOffset = handleDistance / Math.max(ratio[X], ratio[Y])}

        <line
          x1={topEdgeMidpoint[X] * ratio[X]}
          y1={topEdgeMidpoint[Y] * ratio[Y]}
          x2={topEdgeMidpoint[X] * ratio[X]}
          y2={(topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}
          stroke={color}
          stroke-width="2"
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${getAngle()}rad)`}
          pointer-events="none"
        />

        <!-- Rotation handle circle with custom cursor -->
        <circle
          cx={topEdgeMidpoint[X] * ratio[X]}
          cy={(topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}
          r={2}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${getAngle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotateCursorSVG()}') 18 18, grab`}
          style:fill={color}
        />
        <circle
          role="slider"
          tabindex="0"
          style:outline="none"
          aria-valuenow={getAngle() * (180 / Math.PI)}
          onmousedown={(e) => {
            if (!panStart && !rotateStart && resizeHandleIndex === undefined) {
              e.stopPropagation();
              rotateStart = centroid;
              rotateStartRevolutions = revolutionCount;
              activeCursor = getRotateCursorSVG();

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
          style:transform={`rotate(${getAngle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotateCursorSVG()}') 18 18, grab`}
          style:fill={color}
          style:opacity="50%"
        />

        <!-- Revolution counter (not rotated, always horizontal) -->
        {@const handleX = topEdgeMidpoint[X] * ratio[X]}
        {@const handleY = (topEdgeMidpoint[Y] - handleOffset) * ratio[Y]}
        {@const centroidPixelX = displayCentroid[X] * ratio[X]}
        {@const centroidPixelY = displayCentroid[Y] * ratio[Y]}
        {@const currentAngle = getAngle()}
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
          stroke={color}
          stroke-width="2"
        />
        <circle
          role="button"
          tabindex="-1"
          style:outline="none"
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
          {(getAngle() * (180 / Math.PI)).toFixed(1)}°
        </text>

        <!-- Increment button (right) -->
        <line
          x1={rotatedHandleX + buttonSpacing - buttonRadius}
          y1={rotatedHandleY}
          x2={rotatedHandleX + buttonSpacing + buttonRadius}
          y2={rotatedHandleY}
          stroke={color}
          stroke-width="2"
        />
        <line
          x1={rotatedHandleX + buttonSpacing}
          y1={rotatedHandleY - buttonRadius}
          x2={rotatedHandleX + buttonSpacing}
          y2={rotatedHandleY + buttonRadius}
          stroke={color}
          stroke-width="2"
        />
        <circle
          role="button"
          tabindex="-1"
          style:outline="none"
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
          cx={point[X] * ratio[X]}
          cy={point[Y] * ratio[Y]}
          r={2}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${getAngle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotatedCursorSVG(handle)}') 18 18, ${getHandleCursor(handle)}`}
          vector-effect="non-scaling-stroke"
          style:stroke={color}
          style:fill={color}
        />
        <circle
          role="grid"
          tabindex="-1"
          style:outline="none"
          onmousedown={(e) => {
            e.stopPropagation();
            if (!panStart && !rotateStart && resizeHandleIndex === undefined) {
              resizeHandleIndex = handle;
              resizeInitialPoints = [...points];
              activeCursor = getRotatedCursorSVG(handle);
            }
          }}
          cx={point[X] * ratio[X]}
          cy={point[Y] * ratio[Y]}
          r={5}
          style:transform-origin={`${displayCentroid[X] * ratio[X]}px ${displayCentroid[Y] * ratio[Y]}px`}
          style:transform={`rotate(${getAngle()}rad)`}
          style:cursor={isEditing ? "none" : `url('${getRotatedCursorSVG(handle)}') 18 18, ${getHandleCursor(handle)}`}
          vector-effect="non-scaling-stroke"
          style:stroke={color}
          style:fill={color}
          style:opacity="50%"
        />
      {/each}
    {/if}
  {/if}

  <!-- Active cursor overlay that persists during drag operations -->
  {#if activeCursor && cursor_pixel}
    <g style="pointer-events: none;">
      <image href={activeCursor} x={cursor_pixel[X] - 18} y={cursor_pixel[Y] - 18} width="36" height="36" />
    </g>
  {/if}
</g>
