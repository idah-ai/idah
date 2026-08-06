<script lang="ts" module>
  export interface GroupDef {
    id: number; name: string; indices: number[]; closed: boolean;
  }
</script>

<script lang="ts">
  import LandmarkPoint, { rgba, type Point } from './landmark-point.svelte';
  import { viewport } from "$lib/state/viewport.svelte";

  interface Props {
    group    : GroupDef;
    groupPts : Array<Point | undefined>;
    ratio    : Point;
    color    : string;
    editable : boolean;
    preview  : boolean;
    /** This group's path should be highlighted (group-scope hover/drag) */
    highlighted  : boolean;
    /** All points in all groups should show rings (all-scope hover/drag) */
    allActive    : boolean;
    /** The path can be grabbed and dragged (Ctrl or Ctrl+Shift held) */
    pathDraggable: boolean;
    /** Global index of the single highlighted point, -1 = none */
    highlightedPt: number;
    /** Global index of the point being dragged, -1 = none */
    draggedPt    : number;
    onPointMouseDown  : (gi: number) => void;
    onHoverChange     : (gi: number) => void;
    onGroupHoverChange: (gid: number) => void;
    onPathMouseDown   : () => void;
    onmousedown      ?: (e: MouseEvent) => void;
  }

  let {
    group, groupPts, ratio, color, editable, preview,
    highlighted, allActive, pathDraggable,
    highlightedPt, draggedPt,
    onPointMouseDown, onHoverChange, onGroupHoverChange,
    onPathMouseDown, onmousedown,
  }: Props = $props();

  // Inverse viewport scale keeps path strokes constant screen size under pan/zoom
  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let SW       = $derived(4 * invScale);
  let HOVER_W  = $derived(28 * invScale);

  const placed = $derived(
    groupPts
      .map((pt, k) => pt ? { pt, gi: group.indices[k] } : null)
      .filter(Boolean) as Array<{ pt: Point; gi: number }>
  );

  const pathD = $derived.by(() => {
    if (placed.length < 2) return '';
    const d = placed
      .map((e, i) => `${i === 0 ? 'M' : 'L'} ${e.pt[0] * ratio[0]} ${e.pt[1] * ratio[1]}`)
      .join(' ');
    return group.closed && placed.length === group.indices.length ? d + ' Z' : d;
  });

  let pathHovered = $state(false);

  function enterGroup() { pathHovered = true;  onGroupHoverChange(group.id); }
  function leaveGroup() { pathHovered = false; onGroupHoverChange(-1); }

  let _lastPt = -1;
  function emitPtHover(gi: number) {
    if (gi !== _lastPt) { _lastPt = gi; onHoverChange(gi); }
  }

  function ptDown(gi: number, e: MouseEvent) {
    if (!editable) { onmousedown?.(e); return; }
    e.preventDefault(); e.stopPropagation();
    onPointMouseDown(gi);
  }

  function pathDown(e: MouseEvent) {
    if (!editable) { onmousedown?.(e); return; }
    e.preventDefault(); e.stopPropagation();
    if (pathDraggable) onPathMouseDown();
  }
</script>

{#if pathD}
  <!-- Wide transparent stroke: proximity hover along path lines -->
  <path d={pathD} fill="none" stroke="transparent" stroke-width={HOVER_W}
    stroke-linecap="round" stroke-linejoin="round"
    pointer-events={preview ? 'none' : 'all'}
    style:cursor={pathDraggable ? 'grab' : 'default'}
    onmouseenter={enterGroup} onmouseleave={leaveGroup}
    onmousedown={pathDown}
  />

  <!-- Interior fill for closed groups: hover anywhere inside the shape -->
  {#if group.closed}
    <path d={pathD} fill="none" stroke="none"
      pointer-events={preview ? 'none' : 'fill'}
      style:cursor={pathDraggable ? 'grab' : 'default'}
      onmouseenter={enterGroup} onmouseleave={leaveGroup}
      onmousedown={pathDown}
    />
  {/if}

  <!-- Visible path:
       Preview ghost:    dim dashed (0.3)
       Editable at rest: dim solid  (0.3), bright on hover/highlight (0.75)
       Display at rest:  very dim   (0.15), subtle on hover (0.5)            -->
  <path d={pathD} fill="none"
    stroke={rgba(color,
      preview   ? 0.3 :
      editable  ? (pathHovered || highlighted ? 0.75 : 0.3) :
      pathHovered ? 0.5 : 0.15
    )}
    stroke-width={SW}
    stroke-dasharray={preview ? '4 3' : 'none'}
    stroke-linecap="round" stroke-linejoin="round"
    pointer-events="none"
  />
{/if}

{#each placed as { pt, gi }}
  {@const cx         = pt[0] * ratio[0]}
  {@const cy         = pt[1] * ratio[1]}
  {@const isDragged  = draggedPt === gi}
  {@const ringActive = isDragged || highlightedPt === gi || highlighted || allActive}

  <LandmarkPoint
    {cx} {cy} {color} {editable} {preview} {ringActive} {isDragged}
    globalIndex={gi}
    onmousedown={(e) => ptDown(gi, e)}
    onmouseenter={() => emitPtHover(gi)}
    onmouseleave={() => emitPtHover(-1)}
  />
{/each}
