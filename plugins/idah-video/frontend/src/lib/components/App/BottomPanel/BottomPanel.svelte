<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";
  import { transformAnnotationsToTracks } from "$lib/components/App/VideoAnnotationWorkspace/utils/group-annotation.svelte";

  import TimelinePanel from "$lib/components/App/BottomPanel/_TimelinePanel.svelte";
  import TimelineToolbar from "$lib/components/App/BottomPanel/_TimelineToolbar.svelte";
  import Timeline from "$lib/components/App/Timeline/Timeline.svelte";
  import TimelineZoom from "$lib/components/App/Timeline/TimelineZoom.svelte";
  import VideoController from "$lib/components/App/Viewport/VideoController.svelte";
  import AnnotationTrackInfo from "$lib/components/App/Timeline/annotations/_AnnotationTrackInfo.svelte";
  import TrackInfoHeader from "$lib/components/App/Timeline/annotations/_TrackInfoHeader.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import type { IVideoAnnotationRecord } from "$idah/v2/video-types";
  import type Video from "$lib/components/App/Viewport/Video.svelte";

  // Props
  interface Props {
    viewportAnnotations: IVideoAnnotationRecord[];
    length: number;
    player: Video | undefined;
    volume: { level: number; muted: boolean };
    onSelectAnnotation: (annotation?: IVideoAnnotationRecord) => void;
  }
  let {
    viewportAnnotations,
    length,
    player = $bindable(),
    volume,
    onSelectAnnotation,
  }: Props = $props();

  // Internal state
  let panelHeight: number = $state(0);
  let toolbarHeight: number = $state(0);
  let zoomFn: ((newZoom: number) => void) | undefined = $state();

  const TARGET_MAJOR_STEP_PX = 80;
  const TARGET_MINOR_STEP_PX = 20;

  function generateSeriesUpTo(target: number): number[] {
    const series: number[] = [1];
    let current = 1;
    let idx = 1;
    while (current < target) {
      idx++;
      current = series[idx - 2] * (idx % 2 === 0 ? 2 : 5);
      series.push(current);
    }
    return series;
  }

  function roundToSeries(target: number): number {
    if (target <= 1) return 1;
    const series = generateSeriesUpTo(target);
    let closest = series[0];
    for (const val of series) {
      if (val <= target) closest = val;
    }
    const nextIdx = series.indexOf(closest) + 1;
    const nextVal = nextIdx < series.length ? series[nextIdx] : Infinity;
    return Math.abs(target - closest) <= Math.abs(target - nextVal) ? closest : nextVal;
  }

  const containerWidth = $derived(viewport.timeline.dimensions[0]);

  const effectiveRulerMajorStep = $derived.by<number>(() => {
    if (containerWidth <= 0) return 50;
    const target = (TARGET_MAJOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / containerWidth;
    return Math.max(1, roundToSeries(Math.max(1, target)));
  });

  const effectiveRulerMinorStep = $derived.by<number>(() => {
    if (containerWidth <= 0) return 10;
    const target = (TARGET_MINOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / containerWidth;
    const rounded = roundToSeries(Math.max(1, target));
    return rounded === effectiveRulerMajorStep ? 0 : rounded;
  });
</script>

<TimelinePanel bind:panelHeight>
  <TimelineToolbar bind:toolbarHeight>
    <VideoController {volume} bind:video={player} />
    <TimelineZoom {zoomFn} />
  </TimelineToolbar>

    {#if viewportAnnotations.length}
    <Timeline
      onZoom={(fn) => (zoomFn = fn)}
      bind:viewport={viewport.timeline.range}
      items={transformAnnotationsToTracks({
        annotations: viewportAnnotations,
        labelConfig: getDriver().config,
      })}
      {length}
      remainingHeight={panelHeight - toolbarHeight}
      rulerSmallStep={effectiveRulerMinorStep}
      rulerBigStep={effectiveRulerMajorStep}
      bind:currentFrame={viewport.video.currentFrame.value}
      onDimensionsChange={(w, h) => {
        viewport.timeline.dimensions = [w, h];
      }}
    >
      {#snippet TrackInfoHeaderSlot()}
        <TrackInfoHeader annotations={viewportAnnotations} />
      {/snippet}

      {#snippet TrackInfoSlot({ track })}
        <AnnotationTrackInfo {track} onClick={onSelectAnnotation} />
      {/snippet}
    </Timeline>
  {/if}
</TimelinePanel>
