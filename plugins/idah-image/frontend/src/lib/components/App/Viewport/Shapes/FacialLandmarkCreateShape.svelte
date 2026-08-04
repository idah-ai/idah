<script lang="ts">
  import { onMount } from "svelte";
  import { IMAGE_FACIAL_LANDMARK } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { media } from "$lib/state/media.svelte";
  import LandmarkGroup, { type GroupDef } from "./FacialLandmark/landmark-group.svelte";

  // ── Same GROUPS and FACE_TEMPLATE as in facial-landmark.svelte ──────────
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

  const FACE_TEMPLATE: Point[] = [
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
    return FACE_TEMPLATE.map(([tx,ty]) => [x0+tx*sw, y0+ty*sh] as Point);
  }

  type Props = {
    cursor    : Point;
    onSelection: (type: string, points?: Point[], extraProps?: Record<string, unknown>, id?: string) => void;
    color    ?: string;
  };

  let { cursor, onSelection, color = "#22c55e" }: Props = $props();

  let w = $derived(media.width);
  let h = $derived(media.height);

  let buildStart: Point | undefined = $state();

  // Live preview: 68-point template fitted to current drag bounds
  const previewPts = $derived.by((): Array<Point | undefined> => {
    if (!buildStart) return [];
    return fitTemplate(buildStart, cursor);
  });

  export function handleMouseDown(c: Point) {
    buildStart = [c[0], c[1]];
  }

  export function handleMouseUp(c: Point): boolean {
    if (!buildStart) return false;
    const start = buildStart;
    buildStart = undefined;

    if (Math.abs(c[0] - start[0]) * w < 10 || Math.abs(c[1] - start[1]) * h < 10) return false;

    // Pass the 68-point template fitted to the drag bbox directly, so the
    // annotation is created with full landmark points — avoiding a separate
    // auto-fit update step that would otherwise break undo/redo.
    const fitted = fitTemplate(start, c);
    onSelection(IMAGE_FACIAL_LANDMARK, fitted as Point[], {}, undefined);
    return true;
  }

  onMount(() => () => { buildStart = undefined; });
</script>

<!-- Show live 68-point preview during drag instead of a plain rectangle -->
{#if buildStart}
  {#each GROUPS as g (g.id)}
    <LandmarkGroup
      group={g}
      groupPts={g.indices.map(i => previewPts[i])}
      ratio={[w, h]}
      {color}
      editable={false}
      preview={true}
      highlighted={false}
      allActive={false}
      pathDraggable={false}
      highlightedPt={-1}
      draggedPt={-1}
      onPointMouseDown={() => {}}
      onHoverChange={() => {}}
      onGroupHoverChange={() => {}}
      onPathMouseDown={() => {}}
    />
  {/each}
{/if}
