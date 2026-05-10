<script lang="ts">
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$idah/v2/video-types";
  import BBoxShape from "./BBoxShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";
  import type { Point } from "$lib/utils/math/point";

  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], angle: number) => void;
  };

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = "default",
    onClick,
    onEditComplete,
  }: Props = $props();

  /** Component refs (any type because Svelte5 component instances). */
  let _bboxComp: any = $state();
  let _polyComp: any = $state();

  /** Expose the active tool selection to parents. */
  let _toolSelection = $derived.by<{ startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined>(() => {
    const comp = annotation?.shape?.type === IDAH_VIDEO_BOUNDING_BOX ? _bboxComp : _polyComp;
    if (comp?.startSelection && comp?.endSelection) {
      return {
        startSelection: (p: Point, shiftKey?: boolean) => comp.startSelection(p, shiftKey),
        endSelection: (p: Point) => comp.endSelection(p),
      };
    }
    return undefined;
  });

  export function getToolSelection(): { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined {
    return _toolSelection;
  }
</script>

{#if annotation?.shape?.type === IDAH_VIDEO_BOUNDING_BOX}
  <BBoxShape
    bind:this={_bboxComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {mode}
    {onClick}
    {onEditComplete}
  />
{:else if annotation?.shape?.type === IDAH_VIDEO_POLYGON}
  <PolygonShape
    bind:this={_polyComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {mode}
    {onClick}
    {onEditComplete}
  />
{/if}
