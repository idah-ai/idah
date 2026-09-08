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

  /** Component refs (any type because Svelte5 component instances). */
  let _bboxComp: any = $state();
  let _circleComp: any = $state();
  let _ellipseComp: any = $state();
  let _lineComp: any = $state();
  let _polyComp: any = $state();

  /** Map shape type to its component ref. */
  function _compForType(type: string | undefined): any {
    switch (type) {
      case IDAH_IMAGE_BOUNDING_BOX: return _bboxComp;
      case IDAH_IMAGE_CIRCLE:       return _circleComp;
      case IDAH_IMAGE_ELLIPSE:      return _ellipseComp;
      case IDAH_IMAGE_LINE:         return _lineComp;
      default:                      return _polyComp;
    }
  }

  /** Expose the active tool selection to parents. */
  let _toolSelection = $derived.by<
    { startSelection: (p: Point, altKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined
  >(() => {
    const comp = _compForType(annotation?.shape?.type);
    if (comp?.startSelection && comp?.endSelection) {
      return {
        startSelection: (p: Point, altKey?: boolean) => comp.startSelection(p, altKey),
        endSelection: (p: Point) => comp.endSelection(p),
      };
    }
    return undefined;
  });

  export function getToolSelection():
    | { startSelection: (p: Point, altKey?: boolean) => boolean; endSelection: (p: Point) => void }
    | undefined {
    return _toolSelection;
  }

  /** Expose whether the user is actively editing (dragging/resizing) this annotation. */
  let _isEditing = $derived.by((): boolean => {
    return _compForType(annotation?.shape?.type)?.getIsEditing?.() ?? false;
  });

  export function getIsEditing(): boolean {
    return _isEditing;
  }
</script>

{#if annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX}
  <BBoxShape
    bind:this={_bboxComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {multiDragDelta}
    {mode}
    {onClick}
    {onEditComplete}
  />
{:else if annotation?.shape?.type === IDAH_IMAGE_CIRCLE}
  <CircleShape
    bind:this={_circleComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {multiDragDelta}
    {mode}
    {onClick}
    {onEditComplete}
  />
{:else if annotation?.shape?.type === IDAH_IMAGE_ELLIPSE}
  <EllipseShape
    bind:this={_ellipseComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {multiDragDelta}
    {mode}
    {onClick}
    {onEditComplete}
  />
{:else if annotation?.shape?.type === IDAH_IMAGE_LINE}
  <LineShape
    bind:this={_lineComp}
    {annotation}
    {selected}
    {editable}
    {cursor}
    {multiDragDelta}
    {mode}
    {onClick}
    {onEditComplete}
  />
{:else if annotation?.shape?.type === IDAH_IMAGE_POLYGON}
  <PolygonShape
    bind:this={_polyComp}
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
