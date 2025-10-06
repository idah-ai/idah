<script lang="ts">
  import TimelineCell from "./timeline-cell.svelte";
  import type { VideoAnnotation } from "../VideoAnnotationContext";

  let {
    annotation,
    currentFrame,
    range,
    scale,
    hoveredColumn,
    onCellHover,
    onSeekFrame,
    onSelectAnnotation,
    onDeleteAnnotation,
    ...restProps
  }: {
    annotation: VideoAnnotation;
    currentFrame: number;
    range: [number, number];
    scale: number;
    hoveredColumn?: number;
    onCellHover: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation, frame: number) => void;
  } = $props();

  // Variables
  let frameCells = $derived(Math.ceil((range[1] - range[0]) / scale) + 1);

  // Functions
  function setHoveredColumn(column?: number) {
    onCellHover(column);
  }
</script>

<div class="h-8">
  {#if frameCells > 0}
    {#each Array(frameCells) as _u, i (i)}
      {@const currentFrameInCell = range[0] + i * scale}

      <TimelineCell
        {annotation}
        frame={currentFrameInCell}
        {currentFrame}
        {range}
        {scale}
        inSpan={Math.floor((annotation.shape.start - range[0]) / scale) <= i &&
          Math.floor((annotation.shape.end - range[0]) / scale) >= i}
        {onSeekFrame}
        keyframes={annotation.shape.frames
          .filter((s) => Math.floor((s.frame - range[0]) / scale) == i)
          .map((s) => s.frame)}
        {onSelectAnnotation}
        onDeleteFrame={(frame) => onDeleteAnnotation(annotation, frame)}
        hovered={hoveredColumn == currentFrameInCell}
        onmouseover={() => setHoveredColumn(currentFrameInCell)}
        onmouseenter={() => setHoveredColumn(currentFrameInCell)}
        onmouseleave={() => setHoveredColumn(undefined)}
        {...restProps}
      />
    {/each}
  {/if}
</div>
