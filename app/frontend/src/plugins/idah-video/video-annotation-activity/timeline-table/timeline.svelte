<script lang="ts">

  import type {
      AnnotationMetadata,
      AnnotationObj,
      AnnotationShape,
      AnnotationValue,
  } from "@/context/AnnotationContext";
  import { ENTRY_ROOT } from "../../type";
  import AnnotationTimelineCell from "./annotation-timeline-cell.svelte";

  let {
    annotations,
    currentFrame,
    range,
    scale,
    zoom,
    totalFrames,
    hoveredColumn,
    onCellHover,
    onSeekFrame,
    onSelectAnnotation,
    onDeleteAnnotation,
    ...restProps
  }: {
    annotations: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[];
    currentFrame: number;
    range: [number, number];
    scale: number;
    zoom: number;
    totalFrames: number;
    hoveredColumn?: number;
    onCellHover: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) => void;
    onDeleteAnnotation: (
      annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
      frame: number,
    ) => void;
  } = $props();

  // Variables
  let frameCells = $derived(Math.ceil((range[1] - range[0]) / scale) + 1);
 let range_span = $derived(Math.min(scale * zoom, totalFrames));
  let cellWidth: number = $derived((1 / ((range[1] - range[0] + (scale - (range_span % scale))) / 100)) * scale);

  // Functions
  function setHoveredColumn(column?: number) {
    onCellHover(column);
  }
</script>

<div class="h-8">
  {#if frameCells > 0}
  {#each Array(frameCells) as _u, i (i)}
  {@const currentFrameInCell = range[0] + i * scale}
 
  
  {#each annotations as annotation (annotation.metadata.id)}
        <AnnotationTimelineCell
          {annotation}
          frame={currentFrameInCell}
          {currentFrame}
          {range}
          {scale}
          {zoom}
          {totalFrames}
          inSpan={annotation.shape.type == ENTRY_ROOT ||
            (currentFrameInCell >= annotation.shape.start && currentFrameInCell <= annotation.shape.end)}
          {onSeekFrame}
          keyframes={(annotation.shape.frames || [])
            .filter((s) => {
              const start = range[0] + i * scale;
              const end = start + scale;
              return s.frame >= start && s.frame < end;
            })
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
    {/each}
  {/if}
</div>
