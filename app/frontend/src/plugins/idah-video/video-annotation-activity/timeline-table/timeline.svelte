<script lang="ts">
  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";
  import TimelineCell from "./timeline-cell.svelte";

  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

  let {
    groupId,
    annotations,
    currentFrame,
    range,
    scale,
    zoom,
    totalFrames,
    selectedAnnotation,
    onCellHover,
    onSeekFrame,
    onSelectAnnotation,
    onDeleteAnnotation,
  }: {
    groupId: string;
    annotations: TAnnotationObj[];
    currentFrame: number;
    range: [number, number];
    scale: number;
    zoom: number;
    totalFrames: number;
    selectedAnnotation?: TAnnotationObj;
    onCellHover: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation?: TAnnotationObj) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj, frame: number) => void;
  } = $props();

  // Variables
  let frameCells = $derived(Math.ceil((range[1] - range[0]) / scale) + 1);
  let hoveredAnnotation: TAnnotationObj | undefined = $state(undefined);

  // Functions
  function setHoveredCell(frame?: number) {
    onCellHover(frame);
  }

  function setHoveredAnnotation(annotation?: TAnnotationObj) {
    hoveredAnnotation = annotation;
  }
</script>

<div class="h-8">
  {#if frameCells > 0}
    {#each Array(frameCells) as _u, i (i)}
      {@const currentFrameInCell = range[0] + i * scale}

      <TimelineCell
        {groupId}
        {annotations}
        {currentFrameInCell}
        {range}
        {scale}
        {totalFrames}
        {zoom}
        {selectedAnnotation}
        {hoveredAnnotation}
        {onSeekFrame}
        onDeleteFrame={onDeleteAnnotation}
        {onSelectAnnotation}
        onHoverAnnotation={setHoveredAnnotation}
        onHoverCell={setHoveredCell}
      ></TimelineCell>
    {/each}
  {/if}
</div>
