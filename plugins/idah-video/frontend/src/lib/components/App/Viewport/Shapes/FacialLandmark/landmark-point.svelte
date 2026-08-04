<script lang="ts" module>
  export type Point = [number, number];
  export function rgba(col: string, a: number): string {
    const m6 = col.match(/^#([0-9a-f]{6})$/i);
    if (m6) { const n = parseInt(m6[1],16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
    const m3 = col.match(/^#([0-9a-f]{3})$/i);
    if (m3) { const x = (c: string) => parseInt(c+c,16); return `rgba(${x(m3[1][0])},${x(m3[1][1])},${x(m3[1][2])},${a})`; }
    return col;
  }
</script>

<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";

  interface Props {
    cx: number; cy: number;
    color: string;
    editable: boolean;
    preview: boolean;
    ringActive: boolean;
    isDragged: boolean;
    globalIndex: number;
    onmousedown : (e: MouseEvent) => void;
    onmouseenter: () => void;
    onmouseleave: () => void;
  }
  let {
    cx, cy, color, editable, preview, ringActive, isDragged, globalIndex,
    onmousedown, onmouseenter, onmouseleave,
  }: Props = $props();

  // Inverse viewport scale keeps handles constant screen size under pan/zoom
  let invScale = $derived(1 / viewport.workspace.transform.scale);
  let DOT_R    = $derived(4 * invScale);
  let HIT_R    = $derived(10 * invScale);
  let FONT_SZ  = $derived(18 * invScale);
  let SW       = $derived(2 * invScale);
  // Index is only relevant when editable and not in template-preview mode
  const showIndex = editable && !preview;
</script>

<circle cx={cx} cy={cy} r={DOT_R}
  fill={preview ? rgba(color, 0.35) : color}
  stroke={showIndex ? color : 'none'}
  stroke-width={showIndex ? SW * 2 : 0}
  vector-effect="non-scaling-stroke" pointer-events="none"
/>

{#if showIndex}
  <text x={cx + DOT_R + 3} y={cy} fill={color} font-size={FONT_SZ * 0.8}
    dominant-baseline="middle" font-family="monospace" font-weight="600"
    paint-order="stroke" stroke={rgba('#000', 0.5)} stroke-width={SW * 3}
    pointer-events="none">{globalIndex + 1}</text>
{/if}

{#if !preview}
  <circle class="hit" cx={cx} cy={cy} r={HIT_R}
    fill={ringActive ? rgba(color, 0.3) : 'transparent'}
    stroke={editable ? rgba(color, ringActive ? 0.9 : 0.4) : 'none'}
    stroke-width={SW}
    style:opacity={ringActive ? '1' : '0.5'}
    style:cursor={!editable ? 'default' : isDragged ? 'grabbing' : 'grab'}
    vector-effect="non-scaling-stroke"
    pointer-events={editable ? 'all' : 'none'}
    {onmousedown} {onmouseenter} {onmouseleave}
  />
{/if}

<style>
  .hit:hover { opacity: 1 !important; }
</style>
