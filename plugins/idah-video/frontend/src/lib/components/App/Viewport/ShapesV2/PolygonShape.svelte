<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import type { BBox } from "$lib/utils/math/bbox";
  import { centroid as centroidUtil, type Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import type { IVideoAnnotationShape } from "$idah/v2/video-types";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import {
    pointInPolygon,
    hitTestVertex,
    moveVertex,
    addVertexOnEdge,
  } from "./Polygon/utils";
  import PolygonHandler from "./Polygon/PolygonHandler.svelte";

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = "default",
    onClick,
    onEditComplete,
  }: {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], angle: number) => void;
  } = $props();

  let color = $derived.by(() => resolveAnnotationColor(annotation));

  let w = $derived(media.width);
  let h = $derived(media.height);

  let baseVertices = $derived.by((): Point[] => {
    const shape = annotation?.shape as IVideoAnnotationShape | undefined;
    if (!shape?.frames) return [];
    const result = getInterpolatedFrame(shape, viewport.video.currentFrame.value);
    return result?.points ?? [];
  });

  let _localVertices: Point[] | undefined = $state();
  let dragVertexIndex: number | undefined = $state();
  let panStart: Point | undefined = $state();

  let isEditing = $derived(dragVertexIndex !== undefined || panStart !== undefined);
  let vertices: Point[] = $derived(_localVertices ?? baseVertices);

  let cursorPx = $derived.by((): Point | undefined => {
    if (!cursor) return undefined;
    return [cursor[0] * w, cursor[1] * h];
  });

  let panOffset = $derived.by((): Point => {
    if (panStart && cursorPx) {
      return [
        (cursorPx[0] - panStart[0]) / w,
        (cursorPx[1] - panStart[1]) / h,
      ];
    }
    return [0, 0];
  });

  let displayVertices = $derived.by((): Point[] => {
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      return vertices.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]]) as Point[];
    }
    return vertices;
  });

  let lastDragCursor: Point = $state([-1, -1]);
  $effect(() => {
    if (dragVertexIndex === undefined || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    _localVertices = moveVertex(_localVertices ?? baseVertices, dragVertexIndex, cursor);
  });

  let pathD = $derived.by(() => {
    if (displayVertices.length < 2) return "";
    return (
      displayVertices
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * w} ${p[1] * h}`)
        .join(" ") + (displayVertices.length >= 3 ? " Z" : "")
    );
  });

  function emitComplete() {
    const pts = _localVertices ?? baseVertices;
    if (pts.length < 3) return;
    onEditComplete?.(pts, 0);
  }

  export function startSelection(start: Point): boolean {
    if (!editable || baseVertices.length < 3) return false;

    const vi = hitTestVertex(start, vertices, w, h, 8);
    if (vi >= 0) {
      dragVertexIndex = vi;
      _localVertices = [...(baseVertices)];
      return true;
    }

    if (pointInPolygon(start, vertices)) {
      panStart = [start[0] * w, start[1] * h];
      _localVertices = [...(baseVertices)];
      return true;
    }

    return false;
  }

  export function endSelection(_end: Point) {
    let changed = false;
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      _localVertices = vertices.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]] as Point);
      changed = true;
    }
    if (dragVertexIndex !== undefined) {
      changed = true;
    }
    if (changed) {
      emitComplete();
    }
    _localVertices = undefined;
    dragVertexIndex = undefined;
    panStart = undefined;
  }

  let over = $state(false);
</script>

{#if pathD}
  <path
    d={pathD}
    fill={color}
    fill-opacity={selected ? 0.6 : 0.3}
    stroke={color.replace("0.5", "1")}
    stroke-width={selected ? 3 : 1.5}
    vector-effect="non-scaling-stroke"
    style:outline="none"
    onmouseenter={() => (over = true)}
    onmouseleave={() => (over = false)}
    class={editable && selected ? "cursor-grab" : "cursor-pointer"}
    role="button"
    tabindex="-1"
    onclick={onClick}
    onmousedown={(e) => {
      if (editable && selected && cursor) {
        startSelection(cursor);
      }
      e.stopPropagation();
    }}
  />

  {#if editable && selected && !isEditing && displayVertices.length >= 3}
    <PolygonHandler
      vertices={displayVertices}
      {color}
      {isEditing}
      onStartVertexDrag={(i) => { dragVertexIndex = i; _localVertices = [...(baseVertices)]; }}
      onAddVertex={(i) => {
        const { vertices: newVerts, insertedIndex } = addVertexOnEdge(vertices, i);
        _localVertices = newVerts;
        dragVertexIndex = insertedIndex;
      }}
      onStartPan={() => { panStart = cursor ? [cursor[0] * w, cursor[1] * h] : undefined; _localVertices = [...(baseVertices)]; }}
    />
  {/if}
{/if}
