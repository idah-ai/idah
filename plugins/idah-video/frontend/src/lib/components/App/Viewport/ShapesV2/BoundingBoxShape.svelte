// ---------------------------------------------------------------------------
// BoundingBoxShape.svelte — renders a single bounding box annotation at the
//                            current frame using AABB interpolation
// ---------------------------------------------------------------------------
<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import { interpolateBBox, bboxToPoints, interpolateAngle } from "$lib/utils/math/bbox";
  import { centroid } from "$lib/utils/math/point";
  import type { IVideoFrameSelection } from "$idah/v2/types";
  import type { BBox } from "$lib/utils/math/bbox";

  let { annotation, selected = false, onClick }: { annotation: any; selected?: boolean; onClick?: any } = $props();

  let color = $derived("rgba(246, 64, 43, 0.5)");
  let ratio = $derived.by((): [number, number] => {
    const w = viewport.workspace.dimensions[0];
    const h = viewport.workspace.dimensions[1];
    if (w === 0 || h === 0) return [1, 1];
    return [w, h];
  });

  let angle = $derived.by(() => {
    const frame = viewport.video.currentFrame.value;
    const frames = (annotation?.shape?.frames ?? []) as IVideoFrameSelection[];
    if (frames.length === 0) return 0;

    const exact = frames.find((f) => f.frame === frame);
    if (exact) return exact.angle || 0;

    let before: IVideoFrameSelection | null = null;
    let after: IVideoFrameSelection | null = null;
    for (const f of frames) {
      if (f.frame < frame && (!before || f.frame > before.frame)) before = f;
      if (f.frame > frame && (!after || f.frame < after.frame)) after = f;
    }
    if (!before || !after) return 0;

    const t = (frame - before.frame) / (after.frame - before.frame);
    return interpolateAngle(before.angle || 0, after.angle || 0, t);
  });

  /** Interpolated 4-corner points at the current frame. */
  let points = $derived.by<[number, number][]>(() => {
    const frame = viewport.video.currentFrame.value;
    const frames = (annotation?.shape?.frames ?? []) as IVideoFrameSelection[];
    if (frames.length === 0) return [];

    const exact = frames.find((f) => f.frame === frame);
    if (exact && exact.aabb) return bboxToPoints(exact.aabb);

    let before: IVideoFrameSelection | null = null;
    let after: IVideoFrameSelection | null = null;
    for (const f of frames) {
      if (f.frame < frame && (!before || f.frame > before.frame)) before = f;
      if (f.frame > frame && (!after || f.frame < after.frame)) after = f;
    }
    if (!before || !after || !before.aabb || !after.aabb) return [];

    const t = (frame - before.frame) / (after.frame - before.frame);
    const aabb = interpolateBBox(before.aabb as BBox, after.aabb as BBox, t);
    return bboxToPoints(aabb);
  });

  let pathD = $derived.by(() => {
    if (points.length < 4) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * ratio[0]} ${p[1] * ratio[1]}`).join(" ") + " Z";
  });

  let centroidPx = $derived.by((): [number, number] => {
    if (points.length === 0) return [0, 0];
    const c = centroid(points);
    return [c[0] * ratio[0], c[1] * ratio[1]];
  });
</script>

{#if pathD}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <path
    d={pathD}
    fill={color}
    fill-opacity={selected ? 0.6 : 0.3}
    stroke={color.replace("0.5", "1")}
    stroke-width={selected ? 3 : 1.5}
    onclick={onClick}
    role="button"
    tabindex="-1"
    style:transform-origin="{centroidPx[0]}px {centroidPx[1]}px"
    style:transform="rotate({angle}rad)"
  />
{/if}
