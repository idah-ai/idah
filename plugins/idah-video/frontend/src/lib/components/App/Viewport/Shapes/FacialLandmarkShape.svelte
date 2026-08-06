<script lang="ts">
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { type Point } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { VIDEO_FACIAL_LANDMARK, type IVideoAnnotationShape } from "$lib/types";
  import FacialLandmark from "./FacialLandmark/facial-landmark.svelte";

  type Props = {
    annotation    : any;
    selected     ?: boolean;
    editable     ?: boolean;
    cursor       ?: Point;
    mode         ?: string;
    onClick      ?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], angle: number) => void;
  };

  let {
    annotation,
    selected      = false,
    editable      = false,
    cursor,
    mode          = "editor",
    onClick,
    onEditComplete,
  }: Props = $props();

  let color = $derived(resolveAnnotationColor(annotation));

  // The SVG viewBox encodes pan/zoom; draw at media-pixel coordinates.
  let ratio  = $derived<Point>([media.width, media.height]);
  const offset: Point = [0, 0];

  let normCursor = $derived<Point>(cursor ?? [0, 0]);

  // Interpolated points at the displayed frame
  let basePoints = $derived.by((): Point[] => {
    const shape = annotation?.shape as IVideoAnnotationShape | undefined;
    if (!shape?.frames) return [];
    const result = getInterpolatedFrame(shape, viewport.video.displayedFrame.value);
    return (result?.points ?? []) as Point[];
  });

  let isEditing = $state(false);
  let landmark: FacialLandmark | undefined = $state();

  export function startSelection(start: Point): boolean {
    if (!editable || !selected) return false;
    return landmark?.startSelection(start) ?? false;
  }

  export function endSelection(end: Point): void {
    landmark?.endSelection(end);
  }

  export function getIsEditing(): boolean {
    return isEditing;
  }
</script>

<FacialLandmark
  bind:this={landmark}
  points={basePoints}
  {ratio} {offset}
  cursor={normCursor}
  {color}
  editable={editable && selected}
  onmousedown={(e) => {
    if (!viewport.isCreationMode) { onClick?.(e); e.stopPropagation(); }
  }}
  onChange={(pts) => onEditComplete?.(pts, 0)}
  onEditingChange={(v) => { isEditing = v; }}
/>
