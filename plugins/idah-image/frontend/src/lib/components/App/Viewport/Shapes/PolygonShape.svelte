<script lang="ts">
  import { showToast } from "$lib/components/ui/Toast/index.svelte";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { resolveShapeStyles } from "$lib/utils/styles";
  import { addVertexOnEdge, hitTestVertex, moveVertex, pointInPolygon } from "./Polygon/utils";

  import PolygonHandler from "./Polygon/_PolygonHandler.svelte";
  import PolygonScaleHandler from "./Polygon/_PolygonScaleHandler.svelte";

  import type { IImageAnnotationShape } from "$lib/types";
  import { type Point } from "$lib/utils/math/point";

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

  // ── Shape display styles from property options ─────────────────────────
  let shapeStyleString = $derived.by(() => resolveShapeStyles(annotation));

  let w = $derived(media.width);
  let h = $derived(media.height);

  let baseVertices = $derived.by((): Point[] => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    if (!shape?.frames) return [];
    const result = getInterpolatedFrame(shape, viewport.image.currentFrame.value);
    return result?.points ?? [];
  });

  let _localVertices: Point[] | undefined = $state();
  let dragVertexIndex: number | undefined = $state();
  let panStart: Point | undefined = $state();

  let scaleHandler: PolygonScaleHandler | undefined = $state();
  // Multi-selection state
  let _selectedIndices: Set<number> = $state(new Set());
  let boxStart: Point | undefined = $state();
  let boxEnd: Point | undefined = $state();
  let multiDragOrigin: Point | undefined = $state();

  // Track Shift key for cursor changes
  let shiftHeld = $state(false);

  let isEditing = $derived(
    dragVertexIndex !== undefined ||
      panStart !== undefined ||
      multiDragOrigin !== undefined ||
      (scaleHandler?.isActive() ?? false),
  );
  let vertices: Point[] = $derived(_localVertices ?? baseVertices);

  let cursorPx = $derived.by((): Point | undefined => {
    if (!cursor) return undefined;
    return [cursor[0] * w, cursor[1] * h];
  });

  let panOffset = $derived.by((): Point => {
    if (panStart && cursorPx) {
      return [(cursorPx[0] - panStart[0]) / w, (cursorPx[1] - panStart[1]) / h];
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
    _localVertices = base.map((p, i) => (_selectedIndices.has(i) ? ([p[0] + dx, p[1] + dy] as Point) : p));
  });

  let pathD = $derived.by(() => {
    if (displayVertices.length < 2) return "";
    return (
      displayVertices.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * w} ${p[1] * h}`).join(" ") +
      (displayVertices.length >= 3 ? " Z" : "")
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
    const vi = hitTestVertex(start, vertices, w, h, 6, viewport.workspace.transform.scale);
    if (vi >= 0) {
      if (shiftKey) {
        // Shift+click on a vertex: delete it (but keep minimum 3 points)
        if (baseVertices.length <= 3) return true;
        const next = [...baseVertices];
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
      _localVertices = [...baseVertices];
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
      _localVertices = [...baseVertices];
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
    if (scaleHandler?.isActive()) {
      const scaled = scaleHandler.endScale();
      if (scaled) {
        _localVertices = scaled;
        changed = true;
      }
    }
    if (changed) {
      emitComplete();
    }
    _localVertices = undefined;
    dragVertexIndex = undefined;
    panStart = undefined;
    multiDragOrigin = undefined;
    _selectedIndices = new Set();
  }

  // ── Cursor style for the shape body ──────────────────────────────────
  //   "cursor-grabbing"  → actively dragging (vertex drag, pan, or multi-drag in progress)
  //   "cursor-grab"      → editable & selected (ready to start a drag)
  //   "cursor-pointer"   → otherwise
  let bodyCursor = $derived(isEditing ? "cursor-grabbing" : editable && selected ? "cursor-grab" : "cursor-pointer");

  let over = $state(false);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window
  onkeydown={(e) => {
    if (e.key === "Shift") shiftHeld = true;
  }}
  onkeyup={(e) => {
    if (e.key === "Shift") shiftHeld = false;
  }}
/>

{#if pathD}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <path
    d={pathD}
    fill={color}
    fill-opacity={selected ? 0.6 : 0.3}
    stroke={color.replace("0.5", "1")}
    stroke-width={selected ? 1.5 : 1}
    vector-effect="non-scaling-stroke"
    style={shapeStyleString}
    style:outline="none"
    onmouseenter={() => (over = true)}
    onmouseleave={() => (over = false)}
    class={bodyCursor}
    role="button"
    tabindex="-1"
    onclick={onClick}
    onmousedown={(e) => {
      // Do not start selection if in creation mode,
      // to avoid interfering with the creation process
      if (viewport.isCreationMode) return;

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
          _localVertices = [...baseVertices];
        }
      }}
      onDeleteVertex={(i) => {
        // If multiple vertices are selected, delete all of them
        const indicesToDelete = _selectedIndices.size > 0 ? [..._selectedIndices].sort((a, b) => b - a) : [i];
        // Can not delete if it would leave less than 3 points
        if (baseVertices.length - indicesToDelete.length < 3) {
          showToast.warning({
            title: "Cannot delete vertex",
            description: "A polygon must have at least 3 points.",
          });
          return;
        }
        const next = [...baseVertices];
        for (const idx of indicesToDelete) {
          next.splice(idx, 1);
        }
        _localVertices = next;
        _selectedIndices = new Set();
        emitComplete();
      }}
      onAddVertex={(i) => {
        const { vertices: newVerts, insertedIndex } = addVertexOnEdge(vertices, i);
        _localVertices = newVerts;
        dragVertexIndex = insertedIndex;
      }}
      onStartPan={() => {
        _selectedIndices = new Set();
        panStart = cursor ? [cursor[0] * w, cursor[1] * h] : undefined;
        _localVertices = [...baseVertices];
      }}
      onStartScale={() => {
        if (cursor) {
          scaleHandler?.startScale(cursor[0]);
        }
      }}
    />
  {/if}

  <PolygonScaleHandler
    bind:this={scaleHandler}
    {baseVertices}
    {color}
    {cursor}
    onScaleUpdate={(scaled) => {
      _localVertices = scaled;
    }}
  />
{/if}
