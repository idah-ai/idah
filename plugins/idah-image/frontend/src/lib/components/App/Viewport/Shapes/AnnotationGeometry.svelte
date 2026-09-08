<script lang="ts">
  import {
    DEFAULT_MODE,
    IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX,
    IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE,
    IMAGE_ELLIPSE as IDAH_IMAGE_ELLIPSE,
    IMAGE_LINE as IDAH_IMAGE_LINE,
    IMAGE_POLYGON as IDAH_IMAGE_POLYGON,
  } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import BBoxShape from "./BBoxShape.svelte";
  import CircleShape from "./CircleShape.svelte";
  import EllipseShape from "./EllipseShape.svelte";
  import LineShape from "./LineShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";

  const SHAPE_COMPONENTS: Record<string, any> = {
    [IDAH_IMAGE_BOUNDING_BOX]: BBoxShape,
    [IDAH_IMAGE_CIRCLE]: CircleShape,
    [IDAH_IMAGE_ELLIPSE]: EllipseShape,
    [IDAH_IMAGE_LINE]: LineShape,
    [IDAH_IMAGE_POLYGON]: PolygonShape,
  };

  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    multiDragDelta?: Point | null;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps?: Record<string, unknown>) => void;
  };

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    multiDragDelta = null,
    mode = DEFAULT_MODE,
    onClick,
    onEditComplete,
  }: Props = $props();

  let _comp: any = $state();

  let _toolSelection = $derived.by<
    { startSelection: (p: Point, altKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined
  >(() => {
    if (_comp?.startSelection && _comp?.endSelection) {
      return {
        startSelection: (p: Point, altKey?: boolean) => _comp.startSelection(p, altKey),
        endSelection: (p: Point) => _comp.endSelection(p),
      };
    }
    return undefined;
  });

  export function getToolSelection():
    | { startSelection: (p: Point, altKey?: boolean) => boolean; endSelection: (p: Point) => void }
    | undefined {
    return _toolSelection;
  }

  let shapeType = $derived(annotation?.shape?.type);
  let Comp = $derived(shapeType ? (SHAPE_COMPONENTS[shapeType] as any) : undefined);

  export function getIsEditing(): boolean {
    return _comp?.getIsEditing?.() ?? false;
  }
</script>

{#if Comp}
  <Comp
    bind:this={_comp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {multiDragDelta}
    {mode}
    {onClick}
    {onEditComplete}
  />
{/if}
