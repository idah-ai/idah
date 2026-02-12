<script lang="ts">
  import { IDAH_NOTE } from "../type";
  import { X, Y, type InterpolatedVertex, type Point } from "./VideoAnnotationContext";

  let {
    ratio = [1, 1],
    offset = [0, 0],
    points,
    editable = false,
    cursor,
    color,
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
    points: Point[] | InterpolatedVertex[];
    editable?: boolean;
    cursor?: Point;
    color: string;
    mode: string;
    onmousedown?: (e: MouseEvent) => void;
    onChange?: (points: Point[]) => void;
    onEditingChange?: (isEditing: boolean) => void;
    onPointerChange?: (pointer: string | undefined) => void;
    // pointer: string;
    hidden?: boolean;
  } = $props();

  $effect(() => {
    const currentLength = points.length;
    const lengthDiff = currentLength - previousPointsLength;

    if (currentLength === 0) {
      isPolygonComplete = false;
    } else if (currentLength >= 3 && !isPolygonComplete && lengthDiff > 1) {
      isPolygonComplete = true;
    }

    previousPointsLength = currentLength;
  });

  // Update hover state when cursor moves
  $effect(() => {
    if (editable && cursor && isPolygonComplete && !isEditing) {
      isHoveringOverEdge = checkIfNearEdge(cursor);
    } else {
      isHoveringOverEdge = false;
    }
  });

  // Check if cursor is hovering over first point during polygon creation
  $effect(() => {
    if (!isPolygonComplete && cursor && rawPoints.length >= 3) {
      isHoveringOverFirstPoint = isNearPoint(cursor, rawPoints[0], 10);
    } else {
      isHoveringOverFirstPoint = false;
    }
  });

  // Track ALT key presses
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        isAltKeyPressed = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        isAltKeyPressed = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  let isEditing = $derived.by(() => {
    return !isPolygonComplete || panStart != undefined || editingVertexIndex !== undefined;
  });

  let edition_cursor = $derived.by(() => {
    if (isHoveringOverFirstPoint && !isPolygonComplete) {
      // Show pointer cursor when hovering over first point during creation (to close polygon)
      return "cursor-pointer";
    }

    if (isEditing) {
      if (editingVertexIndex !== undefined) {
        return "cursor-move";
      }
      return "cursor-crosshair";
    } else if (isHoveringOverEdge && editable && isPolygonComplete) {
      return "cursor-pen-plus";
    } else if (mode === IDAH_NOTE) {
      return "cursor-note";
    }
  });

  $effect(() => {
    onEditingChange?.(isEditing);
  });
  $effect(() => {
    onPointerChange?.(edition_cursor);
  });

  export function setPolygonComplete(complete: boolean = true) {
    isPolygonComplete = complete;
  }

  export interface ToolSelection {
    startSelection: (start: Point) => void;
    endSelection: (end: Point) => void;
    // isEditing: () => boolean;
  }

  let panStart: Point | undefined = $state(); // polygon pan
  let editingVertexIndex: number | undefined = $state(); // which vertex is being dragged
  let isPolygonComplete: boolean = $state(false);
  let previousPointsLength: number = $state(0);
  let isHoveringOverEdge: boolean = $state(false); // track if cursor is near polygon edge
  let isAltKeyPressed: boolean = $state(false); // track if ALT key is pressed
  let isHoveringOverFirstPoint: boolean = $state(false); // track if cursor is near first point during creation

  // Convert InterpolatedVertex[] to Point[] for internal operations
  let rawPoints: Point[] = $derived.by(() => {
    if (Array.isArray(points) && points.length > 0 && typeof points[0] === "object" && "point" in points[0]) {
      return (points as InterpolatedVertex[]).map((v) => v.point);
    }
    return points as Point[];
  });

  let polygon_points: Point[] = $derived.by(() => {
    if (panStart && cursor) {
      return pan(rawPoints, panStart, cursor);
    } else if (editingVertexIndex !== undefined && cursor) {
      return moveVertex(rawPoints, editingVertexIndex, cursor);
    }
    return rawPoints;
  });

  function draw_cmd(path: Point[]) {
    if (path.length == 0) return;

    return [
      ...path.map((p, i) => `${i == 0 ? "M" : "L"}${p[X]} ${p[Y]}`),
      "Z", // close path
    ].join(" ");
  }

  function draw_preview_cmd(path: Point[], cursorPoint: Point) {
    if (path.length == 0) return;

    return [...path.map((p, i) => `${i == 0 ? "M" : "L"}${p[X]} ${p[Y]}`), `L${cursorPoint[X]} ${cursorPoint[Y]}`].join(
      " ",
    );
  }

  function pan(points: Point[], from: Point, to: Point): Point[] {
    const delta = [to[X] - from[X], to[Y] - from[Y]];
    return points.map((p) => [p[X] + delta[X], p[Y] + delta[Y]]) as Point[];
  }

  function moveVertex(points: Point[], vertexIndex: number, newPosition: Point): Point[] {
    return points.map((p, i) => (i === vertexIndex ? newPosition : p));
  }

  // Check if point is near target point
  // thresholdPixels: threshold in actual pixels (will be converted to normalized coordinates)
  function isNearPoint(point: Point, target: Point, thresholdPixels: number = 10): boolean {
    // Convert pixel threshold to normalized coordinates
    // Use average of X and Y ratios for threshold conversion
    const avgRatio = (ratio[X] + ratio[Y]) / 2;
    const threshold = thresholdPixels / avgRatio;

    const distance = Math.sqrt((point[X] - target[X]) ** 2 + (point[Y] - target[Y]) ** 2);

    return distance < threshold;
  }

  // Check if a point is on a line segment
  // thresholdPixels: threshold in actual pixels (will be converted to normalized coordinates)
  function isOnLineSegment(point: Point, lineStart: Point, lineEnd: Point, thresholdPixels: number = 10): boolean {
    // Convert pixel threshold to normalized coordinates
    // Use average of X and Y ratios for threshold conversion
    const avgRatio = (ratio[X] + ratio[Y]) / 2;
    const threshold = thresholdPixels / avgRatio;

    const x = point[X];
    const y = point[Y];
    const x1 = lineStart[X];
    const y1 = lineStart[Y];
    const x2 = lineEnd[X];
    const y2 = lineEnd[Y];

    const A = x - x1;
    const B = y - y1;
    const D = y2 - y1;
    const C = x2 - x1;

    const lenSq = C * C + D * D;

    // Handle zero-length segment
    if (lenSq === 0) {
      const dx = x - x1;
      const dy = y - y1;
      return Math.hypot(dx, dy) <= threshold;
    }

    const dot = A * C + B * D;
    const param = dot / lenSq;

    // Check if point is outside segment bounds
    // param < 0 means point is before the start of the segment
    // param > 1 means point is after the end of the segment
    if (param < 0 || param > 1) {
      return false;
    }

    // Point is within segment bounds, check perpendicular distance to line
    const xx = x1 + param * C;
    const yy = y1 + param * D;

    const dx = x - xx;
    const dy = y - yy;

    return Math.hypot(dx, dy) <= threshold;
  }

  // Check if cursor is on any edge of the polygon
  function checkIfNearEdge(cursorPoint: Point | undefined): boolean {
    if (!cursorPoint || !isPolygonComplete || rawPoints.length < 3) {
      return false;
    }

    for (let i = 0; i < rawPoints.length; i++) {
      const start = rawPoints[i];
      const end = rawPoints[(i + 1) % rawPoints.length];

      if (isOnLineSegment(cursorPoint, start, end, 3)) {
        return true;
      }
    }

    return false;
  }

  // Find which edge segment the point is on, returns edge index or -1
  function findNearestEdge(point: Point): number {
    if (!isPolygonComplete || rawPoints.length < 3) {
      return -1;
    }

    for (let i = 0; i < rawPoints.length; i++) {
      const start = rawPoints[i];
      const end = rawPoints[(i + 1) % rawPoints.length];
      if (isOnLineSegment(point, start, end, 3)) {
        return i;
      }
    }

    return -1;
  }

  // Insert a new point into the polygon after the specified vertex index
  function insertPointAfterVertex(clickPoint: Point, afterIndex: number): Point[] {
    const newPoints = [...rawPoints];
    newPoints.splice(afterIndex + 1, 0, clickPoint);
    return newPoints;
  }

  // Remove a vertex from the polygon at the specified index
  function removeVertex(vertexIndex: number): Point[] {
    // Don't allow removing if it would result in less than 3 points (minimum for a polygon)
    if (rawPoints.length <= 3) {
      return rawPoints;
    }
    const newPoints = [...rawPoints];
    newPoints.splice(vertexIndex, 1);
    return newPoints;
  }

  export function startSelection(start: Point) {
    if (isPolygonComplete) {
      // Check if clicking on a vertex to edit
      const vertexIndex = rawPoints.findIndex((p) => isNearPoint(p, start, 10));
      if (vertexIndex !== -1) {
        editingVertexIndex = vertexIndex;
      }
    }
  }

  export function endSelection(end: Point) {
    if (!isPolygonComplete) {
      // Adding new vertex
      if (rawPoints.length === 0 || !isNearPoint(rawPoints[rawPoints.length - 1], end, 10)) {
        rawPoints = [...rawPoints, end];
        if (rawPoints.length >= 3 && isNearPoint(rawPoints[0], end, 10)) {
          rawPoints = rawPoints.slice(0, -1); // Remove last point to avoid duplication
          isPolygonComplete = true;
          onChange?.(rawPoints);
        }
      }
    } else {
      // Complete vertex editing or panning
      if (editingVertexIndex !== undefined) {
        onChange?.(polygon_points);
        editingVertexIndex = undefined;
      } else if (panStart) {
        // Check if clicking near an edge to add a new point
        const edgeIndex = findNearestEdge(end);
        if (edgeIndex !== -1 && editable) {
          // Insert new point on the edge
          const newPoints = insertPointAfterVertex(end, edgeIndex);
          onChange?.(newPoints);
          // Set the newly inserted point as being edited
          editingVertexIndex = edgeIndex + 1;
        } else {
          onChange?.(polygon_points);
        }
        panStart = undefined;
      }
    }
  }
</script>

{#snippet PolygonVertices(vertexPoints: Point[] | InterpolatedVertex[])}
  {#each vertexPoints as vertexData, index (index)}
    {@const point = typeof vertexData === "object" && "point" in vertexData ? vertexData.point : vertexData}
    {@const isMatched = typeof vertexData === "object" && "matched" in vertexData ? vertexData.matched : true}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      onmousedown={(e) => {
        e.stopPropagation();
        // Check if ALT key is pressed to remove vertex
        if (e.altKey) {
          const newPoints = removeVertex(index);
          if (newPoints.length !== rawPoints.length) {
            onChange?.(newPoints);
          }
        } else {
          // Normal behavior: set vertex for editing
          editingVertexIndex = index;
        }
      }}
      cx={point[X] * ratio[X]}
      cy={point[Y] * ratio[Y]}
      r={5}
      style:transform-origin="top left"
      style:transform={`translate(${offset[X]}px, ${offset[Y]}px)`}
      class={isAltKeyPressed && rawPoints.length > 3 ? "cursor-minus-icon" : ""}
      style:cursor={isAltKeyPressed && rawPoints.length > 3 ? "" : "move"}
      vector-effect="non-scaling-stroke"
      style:stroke={isMatched ? color : "orange"}
      style:stroke-width={isMatched ? 1 : 3}
      style:stroke-dasharray={isMatched ? "none" : "3,3"}
      style:fill={isMatched ? color : "orange"}
      fill-opacity={isMatched ? 1 : 0}
    />
  {/each}
{/snippet}

{#snippet polygonShape(path?: string)}
  {#if path}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <path
      d={path}
      style:transform-origin="top left"
      style:transform={`translate(${offset[X]}px, ${offset[Y]}px) scale(${ratio[X]}, ${ratio[Y]})`}
      vector-effect="non-scaling-stroke"
      class={isEditing ? "cursor-none" : edition_cursor}
      fill-opacity="0.4"
      style:fill={color}
      style:stroke={color}
      style:stroke-opacity="1"
      style:stroke-width="2"
      onmousedown={(e) => {
        if (editable && !panStart && !isEditing && isPolygonComplete) {
          e.stopPropagation();
          panStart = cursor;
        }
        onmousedown?.(e);
      }}
    />
  {/if}
{/snippet}

<!-- Draw the polygon -->
{#if !hidden}
  {#if isPolygonComplete}
    {@render polygonShape(draw_cmd(polygon_points))}
  {:else if polygon_points.length > 0 && cursor}
    <!-- Preview mode while drawing -->
    <path
      d={draw_preview_cmd(polygon_points, cursor)}
      style:transform-origin="top left"
      style:transform={`translate(${offset[X]}px, ${offset[Y]}px) scale(${ratio[X]}, ${ratio[Y]})`}
      vector-effect="non-scaling-stroke"
      class={isEditing ? "cursor-none" : edition_cursor}
      fill-opacity="0.2"
      style:fill={color}
      style:stroke={color}
      style:stroke-opacity="1"
      style:stroke-width="2"
      style:stroke-dasharray="5,5"
    />

    <!-- Draw existing vertices while creating -->
    {#each polygon_points as point, index (index)}
      <circle
        cx={point[X] * ratio[X]}
        cy={point[Y] * ratio[Y]}
        r={5}
        style:transform-origin="top left"
        style:transform={`translate(${offset[X]}px, ${offset[Y]}px)`}
        style:cursor={index === 0 && polygon_points.length >= 3 ? "pointer" : "default"}
        vector-effect="non-scaling-stroke"
        style:stroke={index === 0 && isHoveringOverFirstPoint ? "#22c55e" : color}
        style:stroke-width={index === 0 && isHoveringOverFirstPoint ? 3 : 1}
        style:fill={color}
        fill-opacity={1}
      />
    {/each}
  {/if}

  <!-- Edit handles for completed polygon -->
  {#if editable && !isEditing}
    {@render PolygonVertices(points)}
  {/if}
{/if}

<style>
  .cursor-note {
    cursor: url("../../assets/icons/message-circle.svg"), auto;
  }

  .cursor-move {
    cursor: move;
  }

  .cursor-pen-plus {
    cursor: url("../../assets/icons/pen-tool-add-2-24x24.svg"), auto;
  }

  .cursor-pen-plus:hover {
    cursor: url("../../assets/icons/pen-tool-add-2-24x24.svg"), auto;
  }

  .cursor-minus-icon {
    cursor: url("../../assets/icons/pen-tool-remove-2-24x24.svg"), auto;
  }

  .cursor-pointer {
    cursor: pointer;
  }
</style>
