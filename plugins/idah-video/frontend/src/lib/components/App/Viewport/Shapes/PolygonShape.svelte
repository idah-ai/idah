<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import type { BBox } from "$lib/utils/math/bbox";
  import { centroid as centroidUtil, type Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import type { IVideoAnnotationShape } from "$lib/types";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import {
    pointInPolygon,
    hitTestVertex,
    moveVertex,
    addVertexOnEdge,
    scalePolygon,
    polygonCentroid,
  } from "./Polygon/utils";
  import PolygonHandler from "./Polygon/_PolygonHandler.svelte";

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

  // Scale bar state
  let scaleBarActive: boolean = $state(false);
  let scaleBarStartX: number = $state(0);
  let scaleBarCurrentX: number = $state(0);
  let scaleBarFactor: number = $state(1);

  // Multi-selection state
  let _selectedIndices: Set<number> = $state(new Set());
  let boxStart: Point | undefined = $state();
  let boxEnd: Point | undefined = $state();
  let multiDragOrigin: Point | undefined = $state();

  // Track Shift key for cursor changes
  let shiftHeld = $state(false);

  let isEditing = $derived(dragVertexIndex !== undefined || panStart !== undefined || multiDragOrigin !== undefined || scaleBarActive);
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

  // Single vertex drag
  $effect(() => {
    if (dragVertexIndex === undefined || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    _localVertices = moveVertex(_localVertices ?? baseVertices, dragVertexIndex, cursor);
  });

  // Box selection drag
  $effect(() => {
    if (!boxStart || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    boxEnd = cursor;
  });

  // Multi-drag: move all selected vertices by the cursor delta
  $effect(() => {
    if (!multiDragOrigin || !cursor || _selectedIndices.size === 0) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    const dx = cursor[0] - multiDragOrigin[0];
    const dy = cursor[1] - multiDragOrigin[1];
    multiDragOrigin = cursor;
    const base = _localVertices ?? baseVertices;
    _localVertices = base.map((p, i) =>
      _selectedIndices.has(i) ? [p[0] + dx, p[1] + dy] as Point : p,
    );
  });

  // Scale bar drag: horizontal movement controls scale factor
  $effect(() => {
    if (!scaleBarActive || !cursor) return;
    if (cursor[0] === lastDragCursor[0] && cursor[1] === lastDragCursor[1]) return;
    lastDragCursor = cursor;
    scaleBarCurrentX = cursor[0];

    // Compute factor from horizontal delta: moving right = scale up, left = scale down
    // Sensitivity: 1 pixel of movement = 0.5% scale change
    const dx = (cursor[0] - scaleBarStartX) * w;
    const factor = Math.max(0.1, Math.min(10, 1 + dx * 0.005));
    scaleBarFactor = factor;
    _localVertices = scalePolygon(baseVertices, factor);
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

  export function startSelection(start: Point, shiftKey = false): boolean {
    if (!editable || baseVertices.length < 3) return false;

    // Check if clicking on a vertex
    const vi = hitTestVertex(start, vertices, w, h, 8);
    if (vi >= 0) {
      if (shiftKey) {
        // Shift+click on a vertex: delete it (but keep minimum 3 points)
        if (baseVertices.length <= 3) return true;
        const next = [...(baseVertices)];
        next.splice(vi, 1);
        _localVertices = next;
        _selectedIndices = new Set();
        emitComplete();
        return true;
      }
      // If this vertex is already in the multi-selection, start multi-drag
      if (_selectedIndices.has(vi)) {
        multiDragOrigin = start;
        _localVertices = [...baseVertices];
        return true;
      }
      // Single vertex drag — clear selection
      _selectedIndices = new Set();
      dragVertexIndex = vi;
      _localVertices = [...(baseVertices)];
      return true;
    }

    if (shiftKey) {
      // Shift+drag anywhere: start box selection (no need to be inside polygon)
      boxStart = start;
      boxEnd = start;
      _localVertices = [...baseVertices];
      return true;
    }

    // Check if clicking on the polygon body
    if (pointInPolygon(start, vertices)) {
      // Start pan — clear selection
      _selectedIndices = new Set();
      panStart = [start[0] * w, start[1] * h];
      _localVertices = [...(baseVertices)];
      return true;
    }

    // Click on empty space — clear selection
    _selectedIndices = new Set();
    return false;
  }

  export function endSelection(end: Point) {
    // Finish box selection
    if (boxStart && boxEnd) {
      const x1 = Math.min(boxStart[0], boxEnd[0]);
      const y1 = Math.min(boxStart[1], boxEnd[1]);
      const x2 = Math.max(boxStart[0], boxEnd[0]);
      const y2 = Math.max(boxStart[1], boxEnd[1]);
      const indices: number[] = [];
      for (let i = 0; i < baseVertices.length; i++) {
        const [px, py] = baseVertices[i];
        if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
          indices.push(i);
        }
      }
      _selectedIndices = new Set(indices);
      boxStart = undefined;
      boxEnd = undefined;
      _localVertices = undefined;
      multiDragOrigin = undefined;
      return;
    }

    let changed = false;
    if (panStart && (panOffset[0] !== 0 || panOffset[1] !== 0)) {
      _localVertices = vertices.map((p) => [p[0] + panOffset[0], p[1] + panOffset[1]] as Point);
      changed = true;
    }
    if (dragVertexIndex !== undefined) {
      changed = true;
    }
    if (multiDragOrigin !== undefined && _localVertices) {
      changed = true;
    }
    if (scaleBarActive && _localVertices) {
      changed = true;
    }
    if (changed) {
      emitComplete();
    }
    _localVertices = undefined;
    dragVertexIndex = undefined;
    panStart = undefined;
    multiDragOrigin = undefined;
    scaleBarActive = false;
    scaleBarFactor = 1;
    _selectedIndices = new Set();
  }

  let over = $state(false);

  // ── Scale bar layout ──────────────────────────────────────────────────
  let centroidN = $derived(polygonCentroid(displayVertices));
  let centroidPx: Point = $derived([centroidN[0] * w, centroidN[1] * h]);
  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let barLength = $derived(120 * invScale);
  let barY = $derived(centroidPx[1] + 30 * invScale);
  let barX1 = $derived(centroidPx[0] - barLength / 2);
  let barX2 = $derived(centroidPx[0] + barLength / 2);
  let thumbX = $derived(centroidPx[0] + (scaleBarFactor - 1) * (barLength / 2) * 0.5);
  let thumbXClamped = $derived(Math.max(barX1, Math.min(barX2, thumbX)));
</script>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onkeydown={(e) => { if (e.key === "Shift") shiftHeld = true; }} onkeyup={(e) => { if (e.key === "Shift") shiftHeld = false; }} />

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
      if (viewport.mode === "idah-video:polygon") return;
      if (editable && selected) {
        // Convert client coords to SVG viewBox coords, then to normalized (0-1) media coords.
        const svg = (e.currentTarget as SVGElement).ownerSVGElement;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svg.getScreenCTM()?.inverse();
          if (ctm) {
            const svgPt = pt.matrixTransform(ctm);
            const norm: Point = [
              media.width > 0 ? svgPt.x / media.width : 0,
              media.height > 0 ? svgPt.y / media.height : 0,
            ];
            startSelection(norm, e.shiftKey);
          }
        }
      }
      e.stopPropagation();
    }}
  />

  {#if editable && selected && !isEditing && displayVertices.length >= 3}
    <PolygonHandler
      vertices={displayVertices}
      {color}
      {isEditing}
      selectedIndices={_selectedIndices}
      {boxStart}
      {boxEnd}
      {shiftHeld}
      onStartVertexDrag={(i) => {
        if (_selectedIndices.size > 0 && _selectedIndices.has(i)) {
          // Vertex is part of multi-selection — start multi-drag
          multiDragOrigin = cursor ? [cursor[0], cursor[1]] : undefined;
          _localVertices = [...baseVertices];
        } else {
          _selectedIndices = new Set();
          dragVertexIndex = i;
          _localVertices = [...(baseVertices)];
        }
      }}
      onDeleteVertex={(i) => {
        if (baseVertices.length <= 3) return;
        const next = [...baseVertices];
        next.splice(i, 1);
        _localVertices = next;
        _selectedIndices = new Set();
        emitComplete();
      }}
      onAddVertex={(i) => {
        const { vertices: newVerts, insertedIndex } = addVertexOnEdge(vertices, i);
        _localVertices = newVerts;
        dragVertexIndex = insertedIndex;
      }}
      onStartPan={() => { _selectedIndices = new Set(); panStart = cursor ? [cursor[0] * w, cursor[1] * h] : undefined; _localVertices = [...(baseVertices)]; }}
      onStartScale={() => {
        if (cursor) {
          scaleBarActive = true;
          scaleBarStartX = cursor[0];
          scaleBarCurrentX = cursor[0];
          scaleBarFactor = 1;
          _localVertices = [...baseVertices];
        }
      }}
    />
  {/if}

  <!-- Scale bar (rendered when active) -->
  {#if scaleBarActive}
    <!-- Track line -->
    <line
      x1={barX1}
      y1={barY}
      x2={barX2}
      y2={barY}
      stroke={color}
      stroke-width={2 * invScale}
      stroke-linecap="round"
      pointer-events="none"
    />
    <!-- Scale markers -->
    <line x1={centroidPx[0]} y1={barY - 6 * invScale} x2={centroidPx[0]} y2={barY + 6 * invScale} stroke={color} stroke-width={1.5 * invScale} pointer-events="none" />
    <line x1={barX1} y1={barY - 4 * invScale} x2={barX1} y2={barY + 4 * invScale} stroke={color} stroke-width={1 * invScale} pointer-events="none" />
    <line x1={barX2} y1={barY - 4 * invScale} x2={barX2} y2={barY + 4 * invScale} stroke={color} stroke-width={1 * invScale} pointer-events="none" />
    <!-- Labels -->
    <text x={barX1} y={barY - 10 * invScale} text-anchor="middle" fill={color} font-size={10 * invScale} pointer-events="none">0.5×</text>
    <text x={centroidPx[0]} y={barY - 10 * invScale} text-anchor="middle" fill={color} font-size={10 * invScale} pointer-events="none">1×</text>
    <text x={barX2} y={barY - 10 * invScale} text-anchor="middle" fill={color} font-size={10 * invScale} pointer-events="none">2×</text>
    <!-- Thumb (draggable) -->
    <circle
      cx={thumbXClamped}
      cy={barY}
      r={6 * invScale}
      fill={color}
      stroke="white"
      stroke-width={2 * invScale}
      style:cursor="ew-resize"
      pointer-events="none"
    />
    <!-- Invisible wide hit zone for the thumb -->
    <line
      x1={barX1}
      y1={barY}
      x2={barX2}
      y2={barY}
      stroke="transparent"
      stroke-width={20 * invScale}
      style:cursor="ew-resize"
      onmousedown={(e) => {
        e.stopPropagation();
        const svg = (e.currentTarget as SVGElement).ownerSVGElement;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svg.getScreenCTM()?.inverse();
          if (ctm) {
            const svgPt = pt.matrixTransform(ctm);
            const normX = media.width > 0 ? svgPt.x / media.width : 0;
            scaleBarActive = true;
            scaleBarStartX = normX;
            scaleBarCurrentX = normX;
            scaleBarFactor = 1;
            _localVertices = [...baseVertices];
          }
        }
      }}
    />
    <!-- Current factor display -->
    <text
      x={centroidPx[0]}
      y={barY + 24 * invScale}
      text-anchor="middle"
      fill={color}
      font-size={11 * invScale}
      font-weight="bold"
      style:paint-order="stroke"
      style:stroke="white"
      style:stroke-width="3px"
      style:stroke-linecap="round"
      style:stroke-linejoin="round"
      pointer-events="none"
    >
      {scaleBarFactor.toFixed(2)}×
    </text>
  {/if}
{/if}