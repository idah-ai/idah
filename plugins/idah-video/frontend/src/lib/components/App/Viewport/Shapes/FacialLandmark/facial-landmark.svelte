<script lang="ts">
  import { untrack } from 'svelte';
  import { viewport } from '$lib/state/viewport.svelte';
  import LandmarkGroup, { type GroupDef } from './landmark-group.svelte';
  import { rgba, type Point }             from './landmark-point.svelte';

  // ── Static data (module-level, never re-created) ──────────────────────────

  const GROUPS: GroupDef[] = [
    { id:0, name:'Jawline',     indices:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], closed:false },
    { id:1, name:'R. Eyebrow',  indices:[17,18,19,20,21],                             closed:false },
    { id:2, name:'L. Eyebrow',  indices:[22,23,24,25,26],                             closed:false },
    { id:3, name:'Nose Bridge', indices:[27,28,29,30],                                closed:false },
    { id:4, name:'Nose Base',   indices:[31,32,33,34,35],                             closed:false },
    { id:5, name:'R. Eye',      indices:[36,37,38,39,40,41],                          closed:true  },
    { id:6, name:'L. Eye',      indices:[42,43,44,45,46,47],                          closed:true  },
    { id:7, name:'Outer Lips',  indices:[48,49,50,51,52,53,54,55,56,57,58,59],        closed:true  },
    { id:8, name:'Inner Lips',  indices:[60,61,62,63,64,65,66,67],                    closed:true  },
  ];

  // Reverse lookup: global point index → GroupDef
  const PT_GROUP: ReadonlyArray<GroupDef | undefined> = (() => {
    const m: Array<GroupDef | undefined> = new Array(68).fill(undefined);
    for (const g of GROUPS) for (const i of g.indices) m[i] = g;
    return m;
  })();

  // Canonical face shape in normalised [0,1] space (symmetric, no duplicates)
  const TEMPLATE: Point[] = [
    [0.08,0.52],[0.06,0.62],[0.07,0.71],[0.11,0.80],[0.19,0.87],
    [0.29,0.93],[0.39,0.97],[0.46,0.99],[0.50,1.00],
    [0.54,0.99],[0.61,0.97],[0.71,0.93],[0.81,0.87],
    [0.89,0.80],[0.93,0.71],[0.94,0.62],[0.92,0.52],
    [0.17,0.36],[0.24,0.31],[0.32,0.29],[0.40,0.30],[0.47,0.34],
    [0.53,0.34],[0.60,0.30],[0.68,0.29],[0.76,0.31],[0.83,0.36],
    [0.50,0.40],[0.50,0.48],[0.50,0.55],[0.50,0.62],
    [0.38,0.66],[0.44,0.68],[0.50,0.69],[0.56,0.68],[0.62,0.66],
    [0.18,0.46],[0.25,0.43],[0.33,0.43],[0.40,0.46],[0.33,0.50],[0.25,0.50],
    [0.60,0.46],[0.67,0.43],[0.75,0.43],[0.82,0.46],[0.75,0.50],[0.67,0.50],
    [0.31,0.79],[0.37,0.75],[0.43,0.73],[0.50,0.72],
    [0.57,0.73],[0.63,0.75],[0.69,0.79],
    [0.64,0.84],[0.57,0.87],[0.50,0.88],[0.43,0.87],[0.36,0.84],
    [0.35,0.79],[0.43,0.77],[0.50,0.76],[0.57,0.77],[0.65,0.79],
    [0.57,0.83],[0.50,0.84],[0.43,0.83],
  ] as Point[];

  function fitTemplate(a: Point, b: Point): Array<Point | undefined> {
    const x0 = Math.min(a[0],b[0]), x1 = Math.max(a[0],b[0]);
    const y0 = Math.min(a[1],b[1]), y1 = Math.max(a[1],b[1]);
    const sw = x1-x0, sh = y1-y0;
    return TEMPLATE.map(([tx,ty]) => [x0+tx*sw, y0+ty*sh] as Point);
  }

  // ── Props ─────────────────────────────────────────────────────────────────

  interface Props {
    points          ?: Point[];
    ratio            : Point;
    offset           : Point;
    cursor           : Point;
    editable        ?: boolean;
    color           ?: string;
    onmousedown     ?: (e: MouseEvent) => void;
    onChange        ?: (points: Point[]) => void;
    onEditingChange ?: (editing: boolean) => void;
  }

  let {
    points = [], ratio, offset, cursor,
    editable = false, color = '#22c55e',
    onmousedown, onChange, onEditingChange,
  }: Props = $props();

  function fromProp(src: Point[]): Array<Point | undefined> {
    return Array.from({ length: 68 }, (_, i) => src[i] ? [src[i][0], src[i][1]] as Point : undefined);
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let pts            = $state<Array<Point | undefined>>(fromProp(points));
  let selectionStart = $state<Point | null>(null);

  type DragMode = 'none' | 'point' | 'group' | 'all';
  let dragMode   = $state<DragMode>('none');
  let dragTarget = $state(-1);
  let dragOrigin : Point                  = [0, 0]; // plain: set before dragMode
  let dragSnap   : Array<Point|undefined> = [];     // plain: set before dragMode

  let hoveredPt   = $state(-1);  // specific point under cursor
  let hoveredGid  = $state(-1);  // group path/fill under cursor (no specific point)
  let faceHovered = $state(false);

  let keyCtrl  = $state(false);
  let keyShift = $state(false);

  // ── Prop sync ─────────────────────────────────────────────────────────────

  $effect(() => {
    const incoming = points;
    if (untrack(() => dragMode) === 'none') pts = fromProp(incoming);
  });

  // Detect initial 4-point bbox → fit 68-point template immediately
  $effect(() => {
    const incoming = points;
    if (incoming.length === 4 && untrack(() => !hasAll)) {
      const fitted = fitTemplate(
        [incoming[0][0], incoming[0][1]],
        [incoming[2][0], incoming[2][1]]
      );
      pts = fitted as Array<Point | undefined>;
      onChange?.(fitted as Point[]);
    }
  });

  $effect(() => {
    const onKey   = (e: KeyboardEvent) => { keyCtrl = e.ctrlKey; keyShift = e.shiftKey; };
    const onReset = () => { keyCtrl = false; keyShift = false; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKey);
    window.addEventListener('blur',    onReset);
    document.addEventListener('visibilitychange', onReset);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup',   onKey);
      window.removeEventListener('blur',    onReset);
      document.removeEventListener('visibilitychange', onReset);
    };
  });

  // ── Core derived ──────────────────────────────────────────────────────────

  // pts.every(Boolean) avoids allocating a filtered array on every recompute
  const hasAll      = $derived(pts.every(Boolean));
  const isDragging  = $derived(dragMode !== 'none');
  const isSelecting = $derived(selectionStart !== null);
  const isEditing   = $derived(editable && (isDragging || isSelecting));

  // Effective hovered group: specific point's group takes priority over path hover
  const effectiveGid = $derived(
    hoveredPt >= 0 ? (PT_GROUP[hoveredPt]?.id ?? -1) : hoveredGid
  );

  // Group id of the drag target (only meaningful when dragMode === 'group')
  const dragGid = $derived(PT_GROUP[dragTarget]?.id ?? -1);

  // Scope: what a mousedown would trigger given current hover + modifier keys
  const previewScope = $derived.by((): 'none'|'point'|'group'|'all' => {
    if (!editable || isDragging) return 'none';
    if (keyCtrl && keyShift) return (hoveredPt >= 0 || hoveredGid >= 0 || faceHovered) ? 'all'   : 'none';
    if (keyCtrl)             return (hoveredPt >= 0 || hoveredGid >= 0)                ? 'group' : 'none';
    return hoveredPt >= 0 ? 'point' : 'none';
  });

  // Pre-computed per-render values passed to all groups (computed once, not 9×)
  const allActive     = $derived(!isSelecting && (previewScope === 'all' || dragMode === 'all'));
  const pathDraggable = $derived(editable && !isSelecting && (previewScope === 'group' || previewScope === 'all'));
  const highlightedPt = $derived(isDragging ? -1 : hoveredPt);

  // cursor is only read when actually dragging or selecting → no recompute on idle mousemove
  const displayPts = $derived.by((): Array<Point|undefined> => {
    if (selectionStart && !hasAll) return fitTemplate(selectionStart, cursor);
    if (!isDragging || !dragSnap.length) return pts;

    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const dx = cursor[0] - dragOrigin[0];
    const dy = cursor[1] - dragOrigin[1];
    const move = (p: Point): Point => [clamp(p[0]+dx), clamp(p[1]+dy)];
    const next = dragSnap.map(p => p ? [p[0],p[1]] as Point : undefined);

    if (dragMode === 'point') {
      const p = dragSnap[dragTarget]; if (p) next[dragTarget] = move(p);
    } else if (dragMode === 'group') {
      PT_GROUP[dragTarget]?.indices.forEach(i => { const p = dragSnap[i]; if (p) next[i] = move(p); });
    } else {
      next.forEach((p, i) => { if (p) next[i] = move(p); });
    }
    return next;
  });

  // Face bounding box for the 'all' scope hit rect — single pass, no spread
  const faceBBox = $derived.by(() => {
    if (!hasAll || !editable) return null;
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    for (const p of displayPts) {
      if (!p) continue;
      const px = p[0]*ratio[0], py = p[1]*ratio[1];
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1-x0, h: y1-y0 };
  });

  // Contextual label near cursor
  const label = $derived.by((): string => {
    if (!editable) return '';
    if (isDragging) {
      if (dragMode === 'all')   return 'All points';
      if (dragMode === 'group') return GROUPS[dragGid]?.name ?? '';
      const g = PT_GROUP[dragTarget];
      return g ? `${g.name} #${dragTarget + 1}` : '';
    }
    if (previewScope === 'all')                        return 'All points';
    if (previewScope === 'group' && effectiveGid >= 0) return GROUPS[effectiveGid]?.name ?? '';
    if (previewScope === 'point' && hoveredPt >= 0) {
      const g = PT_GROUP[hoveredPt];
      return g ? `${g.name} #${hoveredPt + 1}` : '';
    }
    return '';
  });

  const cursorPx = $derived<Point>([cursor[0]*ratio[0], cursor[1]*ratio[1]]);

  // Inverse viewport scale keeps the contextual label constant screen size
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  // ── onEditingChange — deduplicated, no $effect cleanup (avoids spurious false on re-run) ──
  let _prevEditing: boolean | undefined;
  $effect(() => {
    if (isEditing !== _prevEditing) {
      _prevEditing = isEditing;
      onEditingChange?.(isEditing);
    }
  });

  // ── Drag ──────────────────────────────────────────────────────────────────

  function beginDrag(mode: DragMode, target: number): void {
    dragOrigin = [cursor[0], cursor[1]];
    dragSnap   = pts.map(p => p ? [p[0],p[1]] as Point : undefined);
    dragTarget = target;
    dragMode   = mode; // set last: activates displayPts reactive branch
  }

  function commitDrag(): void {
    const committed = displayPts.map(p => p ? [p[0],p[1]] as Point : undefined);
    dragMode = 'none'; dragTarget = -1;
    pts = committed;
    if (hasAll) onChange?.(committed as Point[]);
  }

  // ── Mousedown handlers — stopPropagation blocks parent pan when editable ──
  // No element owns mouseup; endSelection() is the single commit point.

  function onPtDown(gi: number): void {
    if (keyCtrl && keyShift) beginDrag('all',   gi);
    else if (keyCtrl)        beginDrag('group',  gi);
    else                     beginDrag('point',  gi);
  }

  function onPathDown(gid: number): void {
    const g      = GROUPS[gid];
    const anchor = g.indices.find(i => pts[i] != null) ?? g.indices[0];
    beginDrag(previewScope === 'all' ? 'all' : 'group', anchor);
  }

  function onFaceRectDown(e: MouseEvent): void {
    if (!editable) { onmousedown?.(e); return; }
    e.preventDefault(); e.stopPropagation();
    if (previewScope === 'all') {
      const anchor = pts.findIndex(p => p != null);
      if (anchor >= 0) beginDrag('all', anchor);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Called by parent on background mousedown. Starts template placement when empty.
   *  Returns true only when the click was consumed (empty template placement);
   *  otherwise false so the parent can deselect when clicking outside the face. */
  export function startSelection(start: Point): boolean {
    if (editable && !hasAll) {
      selectionStart = [start[0], start[1]];
      return true;
    }
    return false;
  }

  /** Single commit point called by parent on every mouseup. */
  export function endSelection(_end: Point): void {
    if (!editable) return;
    if (isDragging) { commitDrag(); return; }
    if (selectionStart) {
      const fitted = fitTemplate(selectionStart, cursor);
      selectionStart = null;
      pts = fitted as Array<Point|undefined>;
      onChange?.(fitted as Point[]);
    }
  }
</script>

<g
  class="flm-editor"
  role="presentation"
  transform="translate({offset[0]},{offset[1]})"
  {onmousedown}
>
  <!-- Transparent face bbox: lowest in DOM, enables 'all' scope over the face interior -->
  {#if faceBBox && editable}
    <rect
      x={faceBBox.x} y={faceBBox.y} width={faceBBox.w} height={faceBBox.h}
      fill="transparent" stroke="none" pointer-events="all"
      style:cursor={previewScope === 'all' ? (isDragging ? 'grabbing' : 'grab') : 'default'}
      onmouseenter={() => { faceHovered = true;  }}
      onmouseleave={() => { faceHovered = false; }}
      onmousedown={onFaceRectDown}
    />
  {/if}

  {#each GROUPS as g (g.id)}
    {@const highlighted = !isSelecting && (
      (previewScope === 'group' && effectiveGid === g.id) ||
      (dragMode     === 'group' && dragGid      === g.id)
    )}
    <LandmarkGroup
      group={g}
      groupPts={g.indices.map(i => displayPts[i])}
      {ratio} {color} {editable}
      preview={isSelecting}
      {highlighted} {allActive} {pathDraggable} {highlightedPt}
      draggedPt={isDragging ? dragTarget : -1}
      onPointMouseDown={(gi) => onPtDown(gi)}
      onHoverChange={(gi)    => { hoveredPt = gi; }}
      onGroupHoverChange={(gid) => { hoveredGid = gid; }}
      onPathMouseDown={()    => onPathDown(g.id)}
      {onmousedown}
    />
  {/each}

  {#if label}
    <text
      x={cursorPx[0] + 24 * invScale} y={cursorPx[1] - 16 * invScale}
      fill={color} font-size={18 * invScale} font-family="sans-serif" font-weight="600"
      dominant-baseline="auto"
      paint-order="stroke" stroke={rgba('#000', 0.55)} stroke-width={6 * invScale}
      pointer-events="none"
    >{label}</text>
  {/if}
</g>
