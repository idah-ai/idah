<script lang="ts">
  import { IDAH_NOTE } from "$lib/plugin/type";
  import { type Point } from "$lib/utils/math/point";

  import type { IConfigPropertyStyles } from "$idah/context/activity-context";

  let {
    ratio = [1, 1],
    offset = [0, 0],
    points: initialPoints,
    angle = 0,
    editable = false,
    cursor,
    color = "rgba(246, 64, 43, 0.5)",
    styles,
    mode,
    onChange,
    onmousedown,
    // pointer,
    hidden = false,
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
    styles?: IConfigPropertyStyles;
    mode: string;
    onmousedown?: (e: MouseEvent) => void;
    // onChange?: (bb: BoundingBox) => void;
    // pointer: string;
    // hidden?: boolean;
    onChange?: (bb: Point[], angle: number) => void;
    onEditingChange?: (isEditing: boolean) => void;
    onPointerChange?: (pointer: string | undefined) => void;
    // pointer: string;
    hidden?: boolean;
  } = $props();

  export interface ToolSelection {
    startSelection: (start: Point) => void;
    endSelection: (end: Point) => void;
  }

  let points: Point[] = $derived(initialPoints);
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
    return [cursor[0] * ratio[0], cursor[1] * ratio[1]];
  });

  let centroid: Point = $derived.by(() => {
    if (points.length === 0) return [0, 0];
    return getCentroid(points);
  });

  // Calculate pan offset for rendering
  let panOffset: Point = $derived.by(() => {
    if (panStart && cursor_pixel) {
      return [(cursor_pixel[0] - panStart[0]) / ratio[0], (cursor_pixel[1] - panStart[1]) / ratio[1]];
    }
    return [0, 0];
  });

  let isEditing = $derived.by(() => {
    return editable && (!!panStart || !!rotateStart || resizeHandleIndex !== undefined || points.length < 4);
  });

  $effect(() => {
    onEditingChange?.(isEditing);
    return () => onEditingChange?.(false);
  });
  $effect(() => {
    onPointerChange?.(edition_cursor);
    return () => onPointerChange?.(undefined);
  });

  // Update points based on cursor movement (pan)
  let updatedPoints = $derived.by(() => {
    if (panOffset[0] !== 0 || panOffset[1] !== 0) {
      return points.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]]) as Point[];
    }
    return points;
  });

  // Generate preview points while drawing, or use updatedPoints during operations
  let displayPoints = $derived.by(() => {
    if (points.length === 1 && cursor) {
      // Show live preview of rectangle while drawing
      const topLeft: Point = [Math.min(points[0][0], cursor[0]), Math.min(points[0][1], cursor[1])];
      const bottomRight: Point = [Math.max(points[0][0], cursor[0]), Math.max(points[0][1], cursor[1])];

      return [topLeft, [bottomRight[0], topLeft[1]], bottomRight, [topLeft[0], bottomRight[1]]] as Point[];
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
      if (currentCursor[0] !== lastResizeCursor[0] || currentCursor[1] !== lastResizeCursor[1]) {
        lastResizeCursor = currentCursor;
        handleResize(resizeHandleIndex, currentCursor);
      }
    }
  });

  function draw_cmd(path: Point[]) {
    if (path.length === 0) return "";
    return [...path.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * ratio[0]} ${p[1] * ratio[1]}`), "Z"].join(" ");
  }

  // Derive the centroid with pan offset applied for rendering rotation handle
  let displayCentroid: Point = $derived.by(() => {
    if (updatedPoints.length === 0) return [0, 0];
    return getCentroid(updatedPoints);
  });

  function getCentroid(pts: Point[]): Point {
    if (pts.length === 0) return [0, 0];
    return pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map((c) => c / pts.length) as Point;
  }

  function rotatePoint(point: Point, center: Point, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
  }

  // Rotation in normalized space (accounting for non-uniform scaling)
  function rotatePointNormalized(point: Point, center: Point, angle: number, ratio: Point): Point {
    // Convert to pixel space
    const pointPixel: Point = [point[0] * ratio[0], point[1] * ratio[1]];
    const centerPixel: Point = [center[0] * ratio[0], center[1] * ratio[1]];

    // Rotate in pixel space
    const rotated = rotatePoint(pointPixel, centerPixel, angle);

    // Convert back to normalized space
    return [rotated[0] / ratio[0], rotated[1] / ratio[1]];
  }

  function inverseRotatePointNormalized(point: Point, center: Point, angle: number, ratio: Point): Point {
    return rotatePointNormalized(point, center, -angle, ratio);
  }

  function getAngle(): number {
    if (rotateStart && cursor_pixel && rotateStartAngle !== undefined && rotateStartRevolutions !== undefined) {
      // Calculate angle directly in PIXEL space (not normalized)
      // This matches the visual rotation which happens in screen/pixel space
      const centroidPixel: Point = [centroid[0] * ratio[0], centroid[1] * ratio[1]];

      const rel: Point = [cursor_pixel[0] - centroidPixel[0], cursor_pixel[1] - centroidPixel[1]];

      // Measure angle from north (up), clockwise: atan2(X, -Y)
      const currentCursorAngle = Math.atan2(rel[0], -rel[1]);

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
      const topLeft: Point = [Math.min(points[0][0], end[0]), Math.min(points[0][1], end[1])];
      const bottomRight: Point = [Math.max(points[0][0], end[0]), Math.max(points[0][1], end[1])];

      // Create rectangle: top-left, top-right, bottom-right, bottom-left
      points = [topLeft, [bottomRight[0], topLeft[1]], bottomRight, [topLeft[0], bottomRight[1]]];
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
    const minX = Math.min(pts[0][0], pts[1][0], pts[2][0], pts[3][0]);
    const maxX = Math.max(pts[0][0], pts[1][0], pts[2][0], pts[3][0]);
    const minY = Math.min(pts[0][1], pts[1][1], pts[2][1], pts[3][1]);
    const maxY = Math.max(pts[0][1], pts[1][1], pts[2][1], pts[3][1]);

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
    if (isEditing) return "cursor-crosshair";
    if (mode === IDAH_NOTE) return "cursor-note";
    if (over) return editable ? "cursor-grab" : "cursor-pointer";
  });

  function boundingBoxHandle(p: Point[]): Point[] {
    if (p.length !== 4) return [];
    const handles: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      handles.push(p[i]); // Corner handle
      handles.push([(p[i][0] + p[next][0]) / 2, (p[i][1] + p[next][1]) / 2]); // Edge handle
    }
    return handles;
  }

  function handleResize(handleIndex: number, cursorPos: Point) {
    if (points.length !== 4 || resizeInitialPoints.length !== 4) return;

    const currentAngle = getAngle();
    const cursorNormalized: Point = [cursorPos[0] / ratio[0], cursorPos[1] / ratio[1]];

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
    let newTopLeftX = initialTopLeft[0];
    let newTopLeftY = initialTopLeft[1];
    let newBottomRightX = initialBottomRight[0];
    let newBottomRightY = initialBottomRight[1];

    // Determine which point/edge to keep fixed (in unrotated space)
    let fixedPointUnrotated: Point = [0, 0];

    // Handle corner resizing (even indices)
    if (handleIndex % 2 === 0) {
      const cornerIndex = handleIndex / 2;

      switch (cornerIndex) {
        case 0: // top-left corner
          newTopLeftX = unrotatedCursor[0];
          newTopLeftY = unrotatedCursor[1];
          fixedPointUnrotated = initialBottomRight;
          break;
        case 1: // top-right corner
          newBottomRightX = unrotatedCursor[0];
          newTopLeftY = unrotatedCursor[1];
          fixedPointUnrotated = initialBottomLeft;
          break;
        case 2: // bottom-right corner
          newBottomRightX = unrotatedCursor[0];
          newBottomRightY = unrotatedCursor[1];
          fixedPointUnrotated = initialTopLeft;
          break;
        case 3: // bottom-left corner
          newTopLeftX = unrotatedCursor[0];
          newBottomRightY = unrotatedCursor[1];
          fixedPointUnrotated = initialTopRight;
          break;
      }
    }
    // Handle edge resizing (odd indices)
    else {
      const edgeIndex = Math.floor(handleIndex / 2);

      switch (edgeIndex) {
        case 0: // top edge
          newTopLeftY = unrotatedCursor[1];
          fixedPointUnrotated = [(initialTopLeft[0] + initialBottomRight[0]) / 2, initialBottomRight[1]];
          break;
        case 1: // right edge
          newBottomRightX = unrotatedCursor[0];
          fixedPointUnrotated = [initialTopLeft[0], (initialTopLeft[1] + initialBottomRight[1]) / 2];
          break;
        case 2: // bottom edge
          newBottomRightY = unrotatedCursor[1];
          fixedPointUnrotated = [(initialTopLeft[0] + initialBottomRight[0]) / 2, initialTopLeft[1]];
          break;
        case 3: // left edge
          newTopLeftX = unrotatedCursor[0];
          fixedPointUnrotated = [initialBottomRight[0], (initialTopLeft[1] + initialBottomRight[1]) / 2];
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
        (newUnrotatedPoints[oppositeEdge][0] + newUnrotatedPoints[nextCorner][0]) / 2,
        (newUnrotatedPoints[oppositeEdge][1] + newUnrotatedPoints[nextCorner][1]) / 2,
      ];
    }

    // 3. If we rotate the new rectangle around its current centroid, where would the fixed point be?
    const newCentroid = getCentroid(newUnrotatedPoints);
    const newFixedPointScreen = rotatePointNormalized(newFixedPointUnrotated, newCentroid, currentAngle, ratio);

    // 4. Calculate the difference
    const shiftX = fixedPointScreen[0] - newFixedPointScreen[0];
    const shiftY = fixedPointScreen[1] - newFixedPointScreen[1];

    // 5. Shift all points (in unrotated space) to compensate
    points = newUnrotatedPoints.map((p) => [p[0] + shiftX, p[1] + shiftY]) as Point[];
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

  function getBoundingBoxStyles(styles?: IConfigPropertyStyles) {
    const defaultBackgroundOpacity = 0.4;
    const border = styles?.border;

    let dashArray = "none";
    let width = "2";
    let opacity = defaultBackgroundOpacity;

    /** OPACITY */
    /** NOTE:: Can't use switch statement as it will not work with null value  */
    if (styles?.opacity === undefined) {
      opacity = defaultBackgroundOpacity;
    } else if (styles?.opacity === null) {
      opacity = defaultBackgroundOpacity;
    } else if (styles.opacity === 0) {
      opacity = 0;
    } else {
      opacity = (styles?.opacity / 100) * defaultBackgroundOpacity;
    }

    switch (border) {
      case "dashed": {
        dashArray = "10, 10";
        width = "2";
        break;
      }
      case "dotted": {
        dashArray = "1, 10";
        width = "4";
        break;
      }
      default: {
        dashArray = "none";
        width = "2";
        break;
      }
    }

    return { dashArray, width, opacity, strokeColor: opacity ? color : "none" };
  }
</script>

<g transform={`translate(${offset[0]}, ${offset[1]})`}>
  {#if !hidden}
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
        style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
        style:transform={`rotate(${getAngle()}rad)`}
        vector-effect="non-scaling-stroke"
        class={isEditing ? "cursor-none" : edition_cursor}
        fill-opacity={getBoundingBoxStyles(styles).opacity}
        style:fill={color}
        style:stroke={getBoundingBoxStyles(styles).strokeColor}
        style:stroke-width={getBoundingBoxStyles(styles).width}
        stroke-dasharray={getBoundingBoxStyles(styles).dashArray}
        stroke-linecap="round"
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
            x1={displayCentroid[0] * ratio[0]}
            y1={displayCentroid[1] * ratio[1]}
            x2={cursor_pixel[0]}
            y2={cursor_pixel[1]}
            stroke={color}
            stroke-width="2"
            stroke-dasharray="5,5"
          />
          <circle
            cx={displayCentroid[0] * ratio[0]}
            cy={displayCentroid[1] * ratio[1]}
            r={4}
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
            style:transform={`rotate(${getAngle()}rad)`}
            vector-effect="non-scaling-stroke"
            style:stroke={color}
            style:fill={color}
            style:opacity="0.5"
          />
        {/if}

        <!-- Rotation handle (above top edge) -->
        {#if editable && points.length === 4}
          {@const minY = Math.min(updatedPoints[0][1], updatedPoints[1][1], updatedPoints[2][1], updatedPoints[3][1])}
          {@const minX = Math.min(updatedPoints[0][0], updatedPoints[1][0], updatedPoints[2][0], updatedPoints[3][0])}
          {@const maxX = Math.max(updatedPoints[0][0], updatedPoints[1][0], updatedPoints[2][0], updatedPoints[3][0])}

          {@const topEdgeMidpoint = [(minX + maxX) / 2, minY]}
          {@const handleDistance = 60}
          {@const handleOffset = handleDistance / Math.max(ratio[0], ratio[1])}

          <line
            x1={topEdgeMidpoint[0] * ratio[0]}
            y1={topEdgeMidpoint[1] * ratio[1]}
            x2={topEdgeMidpoint[0] * ratio[0]}
            y2={(topEdgeMidpoint[1] - handleOffset) * ratio[1]}
            stroke={color}
            stroke-width="2"
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
            style:transform={`rotate(${getAngle()}rad)`}
            pointer-events="none"
          />

          <!-- Rotation handle circle with custom cursor -->
          <circle
            cx={topEdgeMidpoint[0] * ratio[0]}
            cy={(topEdgeMidpoint[1] - handleOffset) * ratio[1]}
            r={2}
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
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

                const centroidPixel: Point = [displayCentroid[0] * ratio[0], displayCentroid[1] * ratio[1]];
                const rel: Point = [cursor_pixel[0] - centroidPixel[0], cursor_pixel[1] - centroidPixel[1]];
                rotateStartAngle = Math.atan2(rel[0], -rel[1]);
              }
              onmousedown?.(e);
            }}
            cx={topEdgeMidpoint[0] * ratio[0]}
            cy={(topEdgeMidpoint[1] - handleOffset) * ratio[1]}
            r={6}
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
            style:transform={`rotate(${getAngle()}rad)`}
            style:cursor={isEditing ? "none" : `url('${getRotateCursorSVG()}') 18 18, grab`}
            style:fill={color}
            style:opacity="50%"
          />

          <!-- Revolution counter (not rotated, always horizontal) -->
          {@const handleX = topEdgeMidpoint[0] * ratio[0]}
          {@const handleY = (topEdgeMidpoint[1] - handleOffset) * ratio[1]}
          {@const centroidPixelX = displayCentroid[0] * ratio[0]}
          {@const centroidPixelY = displayCentroid[1] * ratio[1]}
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
            cx={point[0] * ratio[0]}
            cy={point[1] * ratio[1]}
            r={2}
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
            style:transform={`rotate(${getAngle()}rad)`}
            style:cursor={isEditing
              ? "none"
              : `url('${getRotatedCursorSVG(handle)}') 18 18, ${getHandleCursor(handle)}`}
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
            cx={point[0] * ratio[0]}
            cy={point[1] * ratio[1]}
            r={5}
            style:transform-origin={`${displayCentroid[0] * ratio[0]}px ${displayCentroid[1] * ratio[1]}px`}
            style:transform={`rotate(${getAngle()}rad)`}
            style:cursor={isEditing
              ? "none"
              : `url('${getRotatedCursorSVG(handle)}') 18 18, ${getHandleCursor(handle)}`}
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
        <image href={activeCursor} x={cursor_pixel[0] - 18} y={cursor_pixel[1] - 18} width="36" height="36" />
      </g>
    {/if}
  {/if}
</g>
