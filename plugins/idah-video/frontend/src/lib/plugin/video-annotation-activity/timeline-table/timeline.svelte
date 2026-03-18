<script lang="ts">
  import type {
    AnnotationGroup,
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "$idah/context/annotation-context";

  import TimelineCell from "$lib/plugin/video-annotation-activity/timeline-table/timeline-cell.svelte";

  type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

  let {
    group,
    annotations,
    range,
    scale,
    zoom,
    totalFrames,
    onCellHover,
    onSeekFrame,
    onSelectAnnotation,
    onDeleteAnnotation,
    onSelectGroupAtFrame,
  }: {
    group: AnnotationGroup<TAnnotationObj>;
    annotations: TAnnotationObj[];
    range: [number, number];
    scale: number;
    zoom: number;
    totalFrames: number;
    onCellHover: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation?: TAnnotationObj) => void;
    onDeleteAnnotation: (annotation: TAnnotationObj, frame: number) => void;
    onSelectGroupAtFrame: (annotationGroup: AnnotationGroup<TAnnotationObj>, frame: number) => void;
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
        {group}
        {annotations}
        {currentFrameInCell}
        {range}
        {scale}
        {totalFrames}
        {zoom}
        {hoveredAnnotation}
        {onSeekFrame}
        onDeleteFrame={onDeleteAnnotation}
        {onSelectAnnotation}
        onHoverAnnotation={setHoveredAnnotation}
        onHoverCell={setHoveredCell}
        {onSelectGroupAtFrame}
      ></TimelineCell>
    {/each}
  {/if}
</div>
