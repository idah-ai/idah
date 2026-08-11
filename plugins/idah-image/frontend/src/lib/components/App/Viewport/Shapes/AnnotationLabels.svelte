<script lang="ts">
  // ---------------------------------------------------------------------------
  // AnnotationLabels.svelte — category name labels drawn on the canvas
  //
  // Rendered as ONE layer after every shape, rather than by each shape itself:
  // shapes are z-sorted, so a per-shape label would be painted over by later
  // shapes' fills — worst exactly in the dense overlapping case where labels
  // are most useful.
  //
  // Each label is centred horizontally on its shape's centre and sits just below
  // it (see labelCenterPx). Centring on the shape keeps the label attached to
  // irregular polygons, where the old bbox-corner anchor floated off into empty
  // space.
  //
  // Masks are excluded (labelCenterPx returns null for them) — they are drawn
  // to a canvas layer, not into this SVG.
  // ---------------------------------------------------------------------------
  import type { IAnnotationRecord } from "$idah/v2/types";
  import { hover } from "$lib/state/hover.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { labelCenterPx, resolveAnnotationLabel } from "$lib/utils/label";
  import { LABEL_FONT, wrapText } from "$lib/utils/text-wrap";

  type Props = { annotations: IAnnotationRecord[] };
  let { annotations }: Props = $props();

  // Screen-space constants. The label group is counter-scaled against the
  // viewport transform, so these stay physically constant at any zoom.
  const FONT_SIZE = 12;
  const LINE_HEIGHT = 14;
  const MAX_WIDTH = 200;

  let w = $derived(media.width);
  let h = $derived(media.height);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  function isVisible(id: string): boolean {
    if (ui.labelVisibility === "always") return true;
    if (ui.labelVisibility === "never") return false;
    // "hover" — also show for the selected annotation: the user has explicitly
    // indicated interest in it, and it would otherwise lose its label the
    // moment the cursor moves to a handle.
    return hover.isHovered(id) || selection.isAnnotationSelected(id);
  }

  type PositionedLabel = { id: string; x: number; y: number; lines: string[] };

  let labels = $derived.by<PositionedLabel[]>(() => {
    if (ui.labelVisibility === "never") return [];
    if (!w || !h) return [];

    const out: PositionedLabel[] = [];
    for (const ann of annotations) {
      if (!isVisible(ann.id)) continue;

      const center = labelCenterPx(ann, w, h);
      if (!center) continue;

      const label = resolveAnnotationLabel(ann);
      if (!label) continue;

      // The warning marker flags a category id that is set on the annotation
      // but absent from the label config — a data problem worth surfacing
      // rather than hiding behind a blank label.
      const text = label.unresolved ? `${label.text} ⚠️` : label.text;

      out.push({ id: ann.id, x: center[0], y: center[1], lines: wrapText(text, MAX_WIDTH, LABEL_FONT) });
    }
    return out;
  });
</script>

{#each labels as label (label.id)}
  <!--
    Counter-scale the whole group rather than multiplying each dimension by
    invScale: font size and line height then all stay screen-constant from a
    single place. The group is translated to the shape centre; the text hangs
    just below that origin — horizontally centred, top edge at the centre. The
    only positioning is the media-space centre, so the label holds the same spot
    on the shape at every zoom (a screen-space y offset would drift off small
    shapes when zoomed out).
  -->
  <g transform="translate({label.x} {label.y}) scale({invScale})">
    <!--
      paint-order:stroke draws the outline behind the glyphs, which is what
      keeps the text readable over arbitrary image content. Same treatment as
      the rotation readout in BoundingBox/_BBoxHandler.svelte.
      pointer-events:none is essential — a label must never swallow a click
      meant for the shape beneath it.
    -->
    <text
      x={0}
      y={0}
      style:font-size="{FONT_SIZE}px"
      style:font-weight="bold"
      style:fill="#fff"
      style:text-anchor="middle"
      style:dominant-baseline="hanging"
      style:paint-order="stroke"
      style:stroke="rgba(0, 0, 0, 0.85)"
      style:stroke-width="3px"
      style:stroke-linecap="round"
      style:stroke-linejoin="round"
      style:pointer-events="none"
      style:user-select="none"
    >
      {#each label.lines as line, i (i)}
        <tspan x={0} dy={i === 0 ? 0 : LINE_HEIGHT}>{line}</tspan>
      {/each}
    </text>
  </g>
{/each}
