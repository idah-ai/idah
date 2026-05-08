<script lang="ts">

  import { viewport } from "$lib/state/viewport.svelte";
  import type { BBox } from "$lib/utils/math/bbox";
  import type { Point } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { ui } from "$lib/state/ui.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotationColor } from "$lib/utils/color";

  let {
    annotation,
    selected = false,
    editable = false,
    cursor,
    mode = "default",
    onClick,
    onEditComplete,
  }: {
    annotation: any;
    selected?: boolean;
    editable?: boolean;
    cursor?: Point;
    mode?: string;
    onClick?: (e: MouseEvent) => void;
    onEditComplete?: (aabb: BBox, angle: number) => void;
  } = $props();

  let color = $derived.by(() => {
    const baseColor = annotationColor(ui.colorMode, annotation, (catId: string) => {
      const config = getDriver().config[annotation?.shape?.type ?? ""];
      return config?.values?.find((v) => v.id === catId)?.color ?? null;
    });
    return baseColor;
  });
  let ratio = $derived.by((): [number, number] => {
    const w = viewport.workspace.dimensions[0];
    const h = viewport.workspace.dimensions[1];
    if (w === 0 || h === 0) return [1, 1];
    return [w, h];
  });

  let vertices = $derived.by<Point[]>(() => {
    const shape = annotation?.shape as { frames?: { frame: number; points: [number, number][]; angle: number }[]; start: number; end: number; type: string } | undefined;
    if (!shape?.frames) return [];
    const result = getInterpolatedFrame(shape, viewport.video.currentFrame.value);
    return result?.points ?? [];
  });

  let pathD = $derived.by(() => {
    if (vertices.length < 2) return "";
    return vertices.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] * ratio[0]} ${p[1] * ratio[1]}`).join(" ") + (vertices.length >= 3 ? " Z" : "");
  });

  // ── Exported tool selection API (no-op for now) ───────────────────────
  export function startSelection(_start: Point): boolean {
    // Polygon editing not yet implemented
    return false;
  }

  export function endSelection(_end: Point) {
    // Polygon editing not yet implemented
  }
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
