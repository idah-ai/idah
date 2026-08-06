<script lang="ts">
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { type Point } from "$lib/utils/math/point";
  import { IMAGE_FACIAL_LANDMARK, type IImageAnnotationShape } from "$lib/types";
  import FacialLandmark from "./FacialLandmark/facial-landmark.svelte";

  type Props = {
    annotation    : any;
    selected     ?: boolean;
    editable     ?: boolean;
    cursor       ?: Point;
    mode         ?: string;
    onClick      ?: (e: MouseEvent) => void;
    onEditComplete?: (points: Point[], extraProps?: Record<string, unknown>) => void;
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

  // The SVG viewBox already encodes pan/zoom, so shapes draw at media-pixel
  // coordinates. ratio = media size, offset = [0,0].
  let ratio  = $derived<Point>([media.width, media.height]);
  const offset: Point = [0, 0];

  // cursor arrives as scene-normalised [0,1] coordinates — pass through.
  let normCursor = $derived<Point>(cursor ?? [0, 0]);

  let basePoints = $derived.by((): Point[] => {
    const shape = annotation?.shape as IImageAnnotationShape | undefined;
    return (shape?.points ?? []) as Point[];
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
  onChange={(pts) => onEditComplete?.(pts, { type: IMAGE_FACIAL_LANDMARK })}
  onEditingChange={(v) => { isEditing = v; }}
/>
