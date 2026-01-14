<script lang="ts">
  import { IDAH_NOTE } from "../type";
  import { X, Y, type Point } from "./VideoAnnotationContext";

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
    pointer,
  }: {
    ratio: Point;
    offset: Point;
    points: Point[];
    editable?: boolean;
    cursor?: Point;
    color: string;
    mode: string;
    onmousedown?: (e: MouseEvent) => void;
    onChange?: (points: Point[]) => void;
    pointer: string;
  } = $props();

  export function isEditing(): boolean {
    return !isPolygonComplete || panStart != undefined || editingVertexIndex !== undefined;
  }

  export function setPolygonComplete(complete: boolean = true) {
    isPolygonComplete = complete;
  }

  export interface ToolSelection {
    startSelection: (start: Point) => void;
    endSelection: (end: Point) => void;
    isEditing: () => boolean;
  }

  let panStart: Point | undefined = $state(); // polygon pan
  let editingVertexIndex: number | undefined = $state(); // which vertex is being dragged
  let isPolygonComplete: boolean = $state(false);
  let previousPointsLength: number = $state(0);
  let isHoveringOverEdge: boolean = $state(false); // track if cursor is near polygon edge
  let isAltKeyPressed: boolean = $state(false); // track if ALT key is pressed

  // Automatically set polygon as complete when loading with existing points (3 or more)
  // Only trigger when points length jumps by more than 1 (indicating a load, not incremental creation)
  $effect(() => {
    const currentLength = points.length;
    const lengthDiff = currentLength - previousPointsLength;

    // If points jumped by more than 1 (e.g., 0->3, 0->4, etc.), it's loading an existing annotation
    // If points increased by exactly 1, it's incremental creation - don't auto-complete
    // Also reset completion state if points go back to 0
    if (currentLength === 0) {
      isPolygonComplete = false;
    } else if (currentLength >= 3 && !isPolygonComplete && lengthDiff > 1) {
      isPolygonComplete = true;
    }

    previousPointsLength = currentLength;
  });

  let polygon_points: Point[] = $derived.by(() => {
    if (panStart && cursor) {
      return pan(points, panStart, cursor);
    } else if (editingVertexIndex !== undefined && cursor) {
      return moveVertex(points, editingVertexIndex, cursor);
    }
    return points;
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

  function isNearPoint(point: Point, target: Point, threshold: number = 0.02): boolean {
    const distance = Math.sqrt(Math.pow(point[X] - target[X], 2) + Math.pow(point[Y] - target[Y], 2));

    return distance < threshold;
  }

  // Check if a point is near a line segment
  function isNearLineSegment(point: Point, lineStart: Point, lineEnd: Point, threshold: number = 0.001): boolean {
    const x = point[X];
    const y = point[Y];
    const x1 = lineStart[X];
    const y1 = lineStart[Y];
    const x2 = lineEnd[X];
    const y2 = lineEnd[Y];

    // Calculate distance from point to line segment
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < threshold;
  }

  // Check if cursor is near any edge of the polygon
  function checkIfNearEdge(cursorPoint: Point | undefined): boolean {
    if (!cursorPoint || !isPolygonComplete || points.length < 3) {
      return false;
    }

    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      if (isNearLineSegment(cursorPoint, start, end, 0.002)) {
        return true;
      }
    }

    return false;
  }

  // Find which edge segment the point is near, returns edge index or -1
  function findNearestEdge(point: Point): number {
    if (!isPolygonComplete || points.length < 3) {
      return -1;
    }

    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      if (isNearLineSegment(point, start, end, 0.001)) {
        return i;
      }
    }

    return -1;
  }

  // Insert a new point into the polygon after the specified vertex index
  function insertPointAfterVertex(clickPoint: Point, afterIndex: number): Point[] {
    const newPoints = [...points];
    newPoints.splice(afterIndex + 1, 0, clickPoint);
    return newPoints;
  }

  // Remove a vertex from the polygon at the specified index
  function removeVertex(vertexIndex: number): Point[] {
    // Don't allow removing if it would result in less than 3 points (minimum for a polygon)
    if (points.length <= 3) {
      return points;
    }
    const newPoints = [...points];
    newPoints.splice(vertexIndex, 1);
    return newPoints;
  }

  // Update hover state when cursor moves
  $effect(() => {
    if (editable && cursor && isPolygonComplete && !isEditing()) {
      isHoveringOverEdge = checkIfNearEdge(cursor);
    } else {
      isHoveringOverEdge = false;
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

  export function startSelection(start: Point) {

    if (!isPolygonComplete) {
      // Adding new vertex
      // if (points.length > 0 && isNearPoint(points[0], start)) {
      //   Close polygon by clicking near the first point
      //   isPolygonComplete = true;
      //   onChange?.(points);
      // }
      // Points are added in endSelection for single click
    } else {
      // Check if clicking on a vertex to edit
      const vertexIndex = points.findIndex((p) => isNearPoint(p, start, 0.001));
      if (vertexIndex !== -1) {
        editingVertexIndex = vertexIndex;
      }
      // else {
      //   // Start panning the entire polygon
      //   panStart = cursor;
      // }
    }
  }

  export function endSelection(end: Point) {
    if (!isPolygonComplete) {
      // Adding new vertex
      if (points.length === 0 || !isNearPoint(points[points.length - 1], end)) {
        points = [...points, end];

        if (points.length >= 3 && isNearPoint(points[0], end)) {
          console.log("Polygon completed");
          points = points.slice(0, -1); // Remove last point to avoid duplication
          isPolygonComplete = true;
          onChange?.(points);
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
          points = newPoints;
          // Set the newly inserted point as being edited
          editingVertexIndex = edgeIndex + 1;
        } else {
          onChange?.(polygon_points);
        }
        panStart = undefined;
      }
    }
  }

  function getCursor() {
    if (isEditing()) {
      if (editingVertexIndex !== undefined) {
        return "cursor-move";
      }
      return "cursor-crosshair";
    } else if (isHoveringOverEdge && editable && isPolygonComplete) {
      return "cursor-pen-plus";
    } else if (mode === IDAH_NOTE) {
      return "cursor-note";
    } else {
      return pointer;
    }
  }
</script>

{#snippet PolygonVertices(vertexPoints: Point[])}
  {#each vertexPoints as point, index (index)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      onmousedown={(e) => {
        e.stopPropagation();
        // Check if ALT key is pressed to remove vertex
        if (e.altKey) {
          const newPoints = removeVertex(index);
          if (newPoints.length !== points.length) {
            points = newPoints;
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
      class={isAltKeyPressed && points.length > 3 ? "cursor-pen-remove" : ""}
      style:cursor={isAltKeyPressed && points.length > 3 ? "" : "move"}
      vector-effect="non-scaling-stroke"
      style:stroke={color}
      style:stroke-width={1}
      style:fill={color}
      fill-opacity={1}
    />
  {/each}
{/snippet}

{#snippet polygonShape(path?: string)}
  {#if path}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <path
      d={path}
      style:cursor={pointer}
      style:transform-origin="top left"
      style:transform={`translate(${offset[X]}px, ${offset[Y]}px) scale(${ratio[X]}, ${ratio[Y]})`}
      vector-effect="non-scaling-stroke"
      class={getCursor()}
      fill-opacity="0.4"
      style:fill={color}
      style:stroke={color}
      style:stroke-opacity="1"
      style:stroke-width="2"
      onmousedown={(e) => {
        if (editable && !panStart && !isEditing() && isPolygonComplete) {
          e.stopPropagation();
          panStart = cursor;
        }
        onmousedown?.(e);
      }}
    />
  {/if}
{/snippet}

<!-- Draw the polygon -->
{#if isPolygonComplete}
  {@render polygonShape(draw_cmd(polygon_points))}
{:else if polygon_points.length > 0 && cursor}
  <!-- Preview mode while drawing -->
  <path
    d={draw_preview_cmd(polygon_points, cursor)}
    style:transform-origin="top left"
    style:transform={`translate(${offset[X]}px, ${offset[Y]}px) scale(${ratio[X]}, ${ratio[Y]})`}
    vector-effect="non-scaling-stroke"
    class={getCursor()}
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
      vector-effect="non-scaling-stroke"
      style:stroke={color}
      style:stroke-width={1}
      style:fill={color}
      fill-opacity={1}
    />
  {/each}
{/if}

<!-- Edit handles for completed polygon -->
{#if editable && !isEditing()}
  {@render PolygonVertices(polygon_points)}
{/if}

<style>
  .cursor-note {
    cursor: url("/app/frontend/src/plugins/assets/icons/message-circle.svg"), auto;
  }

  .cursor-move {
    cursor: move;
  }

  .cursor-pen-plus {
    cursor: url("/app/frontend/src/plugins/assets/icons/pen-tool-add.svg"), auto;
  }

  .cursor-pen-plus:hover {
    cursor: url("/app/frontend/src/plugins/assets/icons/pen-tool-add.svg"), auto;
  }

  .cursor-pen-remove {
    cursor: url("/app/frontend/src/plugins/assets/icons/pen-tool-remove.svg"), auto;
  }
</style>
