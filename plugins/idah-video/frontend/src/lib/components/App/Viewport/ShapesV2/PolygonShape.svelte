// ---------------------------------------------------------------------------
// PolygonShape.svelte — renders a single polygon annotation at the current
//                        frame using vertex interpolation
// ---------------------------------------------------------------------------
<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import { interpolatePolygon } from "$lib/utils/math/polygon";
  import type { IVideoFrameSelection } from "$idah/v2/video-types";
  import type { Point } from "$lib/utils/math/point";

  let { annotation, selected = false, onClick }: { annotation: any; selected?: boolean; onClick?: any } = $props();

  let color = $derived("rgba(100, 100, 255, 0.5)");
  let ratio = $derived.by((): [number, number] => {
    const w = viewport.workspace.dimensions[0];
    const h = viewport.workspace.dimensions[1];
    if (w === 0 || h === 0) return [1, 1];
    return [w, h];
  });

  let vertices = $derived.by<Point[]>(() => {
    const frame = viewport.video.currentFrame.value;
    const frames = (annotation?.shape?.frames ?? []) as IVideoFrameSelection[];
    if (frames.length === 0) return [];

    const exact = frames.find((f) => f.frame === frame);
    if (exact && exact.points) return exact.points as Point[];

    let before: IVideoFrameSelection | null = null;
    let after: IVideoFrameSelection | null = null;
    for (const f of frames) {
      if (f.frame < frame && (!before || f.frame > before.frame)) before = f;
      if (f.frame > frame && (!after || f.frame < after.frame)) after = f;
    }
    if (!before || !after || !before.points || !after.points) return [];

    const t = (frame - before.frame) / (after.frame - before.frame);
    return interpolatePolygon(before.points as Point[], after.points as Point[], t).map((v) => v.point);
  });

  let pathD = $derived.by(() => {
    if (vertices.length < 2) return "";
    return vertices.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * ratio[0]} ${p[1] * ratio[1]}`).join(" ") + (vertices.length >= 3 ? " Z" : "");
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
  />
{/if}
