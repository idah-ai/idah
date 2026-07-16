<script lang="ts">
  import { DEFAULT_MODE, IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX, IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE, IMAGE_ELLIPSE as IDAH_IMAGE_ELLIPSE, IMAGE_LINE as IDAH_IMAGE_LINE, IMAGE_POLYGON as IDAH_IMAGE_POLYGON } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import BBoxShape from "./BBoxShape.svelte";
  import CircleShape from "./CircleShape.svelte";
  import EllipseShape from "./EllipseShape.svelte";
  import LineShape from "./LineShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";

  type AnnotationApi = {
    getToolSelection: () => { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined;
    getIsEditing: () => boolean;
  };

  type Props = {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps?: Record<string, unknown>) => void;
    /** Registers this component's API with the parent by annotation id.
     *  Used instead of `bind:this` to avoid parent teardown recursion —
     *  see ShapesContainer. */
    register?: (id: string, api: AnnotationApi | null) => void;
  };

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = DEFAULT_MODE,
    onClick,
    onEditComplete,
    register,
  }: Props = $props();

  // Register on mount, unregister on teardown (runs flat, unlike bind:this).
  $effect(() => {
    const id = annotation?.id;
    if (id == null) return;
    register?.(id, { getToolSelection, getIsEditing });
    return () => register?.(id, null);
  });

  /** Component refs (any type because Svelte5 component instances). */
  let _bboxComp: any = $state();
  let _circleComp: any = $state();
  let _ellipseComp: any = $state();
  let _lineComp: any = $state();
  let _polyComp: any = $state();

  /** Expose the active tool selection to parents. */
  let _toolSelection = $derived.by<
    { startSelection: (p: Point, shiftKey?: boolean) => boolean; endSelection: (p: Point) => void } | undefined
  >(() => {
    const comp =
      annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX ? _bboxComp :
      annotation?.shape?.type === IDAH_IMAGE_CIRCLE ? _circleComp :
      annotation?.shape?.type === IDAH_IMAGE_ELLIPSE ? _ellipseComp :
      annotation?.shape?.type === IDAH_IMAGE_LINE ? _lineComp :
      _polyComp;
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

  /** Expose whether the user is actively editing (dragging/resizing) this annotation. */
  let _isEditing = $derived.by((): boolean => {
    const comp =
      annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX ? _bboxComp :
      annotation?.shape?.type === IDAH_IMAGE_CIRCLE ? _circleComp :
      annotation?.shape?.type === IDAH_IMAGE_ELLIPSE ? _ellipseComp :
      annotation?.shape?.type === IDAH_IMAGE_LINE ? _lineComp :
      _polyComp;
    return comp?.getIsEditing?.() ?? false;
  });

  export function getIsEditing(): boolean {
    return _isEditing;
  }
</script>

{#if annotation?.shape?.type === IDAH_IMAGE_BOUNDING_BOX}
  <BBoxShape bind:this={_bboxComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{:else if annotation?.shape?.type === IDAH_IMAGE_CIRCLE}
  <CircleShape bind:this={_circleComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{:else if annotation?.shape?.type === IDAH_IMAGE_ELLIPSE}
  <EllipseShape bind:this={_ellipseComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{:else if annotation?.shape?.type === IDAH_IMAGE_LINE}
  <LineShape bind:this={_lineComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{:else if annotation?.shape?.type === IDAH_IMAGE_POLYGON}
  <PolygonShape bind:this={_polyComp} {annotation} {selected} {editable} {cursor} {mode} {onClick} {onEditComplete} />
{/if}
