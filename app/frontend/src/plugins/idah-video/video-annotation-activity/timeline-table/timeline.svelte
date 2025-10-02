<script lang="ts">
  import type { VideoAnnotation } from "../VideoAnnotationContext";
  import TimelineCell from "./timeline-cell.svelte";

  let {
    annotation,
    currentFrame,
    range,
    scale,
    hovered_column,
    hoveredColumnChange,
    onSeekFrame,
    onDeleteAnnotation,
    ...restProps
  }: {
    annotation: VideoAnnotation;
    currentFrame: number;
    range: [number, number];
    scale: number;
    hovered_column?: number;
    hoveredColumnChange: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation, frame: number) => void;
  } = $props();
</script>

<div class="h-8">
  {#if Math.ceil((range[1] - range[0]) / scale) + 1 > 0}
    {#each Array(Math.ceil((range[1] - range[0]) / scale) + 1) as _u, i (i)}
      <TimelineCell
        frame={range[0] + i * scale}
        {currentFrame}
        {range}
        {scale}
        inSpan={Math.floor((annotation.shape.start - range[0]) / scale) <= i &&
          Math.floor((annotation.shape.end - range[0]) / scale) >= i}
        {onSeekFrame}
        keyframes={annotation.shape.frames
          .filter((s) => Math.floor((s.frame - range[0]) / scale) == i)
          .map((s) => s.frame)}
        onDeleteFrame={(frame) => onDeleteAnnotation(annotation, frame)}
        hovered={hovered_column == range[0] + i * scale}
        onmouseover={() => {
          hoveredColumnChange(range[0] + i * scale);
        }}
        onmouseenter={() => {
          hoveredColumnChange(range[0] + i * scale);
        }}
        onmouseleave={() => {
          hoveredColumnChange(undefined);
        }}
        {...restProps}
      />
    {/each}
  {/if}
</div>
