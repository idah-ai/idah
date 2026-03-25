<script lang="ts">
  import TimelineCell from "$lib/plugin/video-annotation-activity/timeline-table/timeline-cell.svelte";

  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
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
    group: AnnotationGroup<VideoAnnotationObject>;
    annotations: VideoAnnotationObject[];
    range: [number, number];
    scale: number;
    zoom: number;
    totalFrames: number;
    onCellHover: (column?: number) => void;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation?: VideoAnnotationObject) => void;
    onDeleteAnnotation: (annotation: VideoAnnotationObject, frame: number) => void;
    onSelectGroupAtFrame: (annotationGroup: AnnotationGroup<VideoAnnotationObject>, frame: number) => void;
  } = $props();

  // Variables
  let frameCells = $derived(Math.ceil((range[1] - range[0]) / scale) + 1);
  let hoveredAnnotation: VideoAnnotationObject | undefined = $state(undefined);

  // Functions
  function setHoveredCell(frame?: number) {
    onCellHover(frame);
  }

  function setHoveredAnnotation(annotation?: VideoAnnotationObject) {
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
