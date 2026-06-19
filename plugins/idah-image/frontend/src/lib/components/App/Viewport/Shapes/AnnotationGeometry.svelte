<script lang="ts">
  import { DEFAULT_MODE, IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX, IMAGE_POLYGON as IDAH_IMAGE_POLYGON } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import BBoxShape from "./BBoxShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";

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
    mode = DEFAULT_MODE,
    onClick,
    onEditComplete,
  }: Props = $props();

  /** Component refs (any type because Svelte5 component instances). */
  let _bboxComp: any = $state();
  let _polyComp: any = $state();

  /** Expose the active tool selection to parents. */
  let _toolSelection = $derived.by<
    { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined
  >(() => {
    const comp = annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX ? _bboxComp : _polyComp;
    if (comp?.startSelection && comp?.endSelection) {
      return {
        startSelection: (p: Point, shiftKey?: boolean) => comp.startSelection(p, shiftKey),
        endSelection: (p: Point) => comp.endSelection(p),
      };
    }
    return undefined;
  });

  export function getToolSelection():
    | { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void }
    | undefined {
    return _toolSelection;
  }
</script>

{#if annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX}
  <BBoxShape bind:this={_bboxComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{:else if annotation?.shape?.type === IDAH_IMAGE_POLYGON}
  <PolygonShape bind:this={_polyComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{/if}
