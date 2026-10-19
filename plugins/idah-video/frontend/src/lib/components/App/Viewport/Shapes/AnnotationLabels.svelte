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
  // An unresolved category (id set on the annotation but absent from the label
  // config) renders a warning icon instead of text; hovering it opens a card
  // explaining the data problem.
  //
  // NOTE: Keep in sync with the idah-image copy. The video variant resolves its
  // centre per frame, so scrubbing moves labels with the interpolated shapes.
  // ---------------------------------------------------------------------------
  import { CircleAlertIcon } from "@lucide/svelte";

  import type { IAnnotationRecord } from "$idah/v2/types";
  import AnnotationLabelNotFound from "$lib/components/App/Error/AnnotationLabelNotFound.svelte";
  import * as HoverCard from "$lib/components/ui/HoverCard/index";
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
  let frame = $derived(viewport.video.displayedFrame.value);
  let invScale = $derived(1 / viewport.workspace.transform.scale);

  let labelHovered = $state<Record<string, boolean>>({});
  let labelCardOpen = $state<Record<string, boolean>>({});

  function isVisible(id: string): boolean {
    if (ui.labelVisibility === "always") return true;
    if (ui.labelVisibility === "never") return false;

    // "hover" — also keep the label alive while the cursor is on its own
    // warning icon or the open card; the icon sits on top of the shape and
    // would otherwise clear the shape hover that keeps the label rendered.
    return (
      hover.isHovered(id) ||
      selection.isAnnotationSelected(id) ||
      labelHovered[id] === true ||
      labelCardOpen[id] === true
    );
  }

  type PositionedLabel = {
    id: string;
    x: number;
    y: number;
    lines: string[];
    unresolved: boolean;
    displayName: string;
  };

  let labels = $derived.by<PositionedLabel[]>(() => {
    if (ui.labelVisibility === "never") return [];
    if (!w || !h) return [];

    const out: PositionedLabel[] = [];
    for (const ann of annotations) {
      if (!isVisible(ann.id)) continue;

      const center = labelCenterPx(ann, w, h, frame);
      if (!center) continue;

      const label = resolveAnnotationLabel(ann);
      if (!label) continue;

      // An unresolved category id is a data problem worth surfacing — render a
      // warning icon (with a hover card) instead of a blank or misleading text.
      out.push({
        id: ann.id,
        x: center[0],
        y: center[1],
        lines: label.unresolved ? [] : wrapText(label.text, MAX_WIDTH, LABEL_FONT),
        unresolved: label.unresolved,
        displayName: label.text,
      });
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
    {#if label.unresolved}
      <!--
        The card content is portaled to <body> by HoverCardPortal, so it escapes
        the SVG even though it is declared inside this <g>. Only the trigger
        lives in the SVG: the child snippet applies the trigger's props (pointer
        handlers, data-state) to this <g> instead of the default <a> element.
        pointer-events:all is required — the icon has fill="none", so the
        default visiblePainted would only make the thin stroke hoverable.
        translate(-8 0) centres the 16px icon on the shape centre, matching the
        text's horizontal centring.
      -->
      <HoverCard.Root openDelay={500} onOpenChange={(open) => (labelCardOpen[label.id] = open)}>
        <g
          role="button"
          tabindex="-1"
          transform="translate(-8 0)"
          style:pointer-events="all"
          style:cursor="help"
          onpointerenter={() => (labelHovered[label.id] = true)}
          onpointerleave={() => (labelHovered[label.id] = false)}
        >
          <HoverCard.Trigger>
            {#snippet child({ props })}
              <g {...props}>
                <CircleAlertIcon class="fill-destructive text-primary-foreground size-4" />
              </g>
            {/snippet}
          </HoverCard.Trigger>
        </g>

        <HoverCard.Content align="center" side="top">
          <AnnotationLabelNotFound displayName={label.displayName} />
        </HoverCard.Content>
      </HoverCard.Root>
    {:else}
      <!--
        paint-order:stroke draws the outline behind the glyphs, which is what
        keeps the text readable over arbitrary video content. Same treatment as
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
    {/if}
  </g>
{/each}
