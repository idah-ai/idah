<script lang="ts">
  import { is } from "zod/locales";
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

  export function startSelection(start: Point) {
    if (!isPolygonComplete) {
      // Adding new vertex

      if (points.length > 0 && isNearPoint(points[0], start)) {
        // Close polygon by clicking near the first point
        // isPolygonComplete = true;
        onChange?.(points);
      }
      // Points are added in endSelection for single click
    } else {
      // Check if clicking on a vertex to edit
      const vertexIndex = points.findIndex((p) => isNearPoint(p, start, 0.03));
      if (vertexIndex !== -1) {
        editingVertexIndex = vertexIndex;
      } else {
        // Start panning the entire polygon
        panStart = cursor;
      }
    }
  }

  export function endSelection(end: Point) {
    if (!isPolygonComplete) {
      // Adding new vertex
      if (points.length === 0 || !isNearPoint(points[points.length - 1], end)) {
        points = [...points, end];

        if (points.length >= 3 && isNearPoint(points[0], end)) {
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
        onChange?.(polygon_points);
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
    } else if (mode === IDAH_NOTE) {
      return "cursor-note";
    } else {
      return pointer;
    }
  }
</script>

{#snippet PolygonVertices(points: Point[])}
  {#each points as point, index (index)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      onmousedown={(e) => {
        e.stopPropagation();
        editingVertexIndex = index;
      }}
      cx={point[X] * ratio[X]}
      cy={point[Y] * ratio[Y]}
      r={5}
      style:transform-origin="top left"
      style:transform={`translate(${offset[X]}px, ${offset[Y]}px)`}
      style:cursor="move"
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
{#if editable}
  {@render PolygonVertices(polygon_points)}
{/if}

<style>
  .cursor-note {
    cursor: url("/app/frontend/src/plugins/assets/icons/message-circle.svg"), auto;
  }

  .cursor-move {
    cursor: move;
  }
</style>
