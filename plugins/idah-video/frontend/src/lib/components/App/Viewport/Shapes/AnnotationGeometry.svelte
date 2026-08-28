<script lang="ts">
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$lib/types";
  import BBoxShape from "./BBoxShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";
  import type { Point } from "$lib/utils/math/point";

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
    onEditComplete?: (points: Point[], angle: number) => void;
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
    mode = "editor",
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

  /** Expose whether the user is actively editing (dragging/resizing) this annotation. */
  let _isEditing = $derived.by((): boolean => {
    const comp = annotation?.shape?.type === IDAH_VIDEO_BOUNDING_BOX ? _bboxComp : _polyComp;
    return comp?.getIsEditing?.() ?? false;
  });

  export function getIsEditing(): boolean {
    return _isEditing;
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
