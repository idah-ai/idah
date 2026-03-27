<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Slider from "$lib/components/ui/slider/slider.svelte";

  import {
    recalculateFramePerScale,
    recalculateFrameRange,
    selectFirstFrameX,
    setTimelineCellWidth,
    TIMELINE_CELL_MAX_WIDTH,
    TIMELINE_CELL_MIN_WIDTH,
    TIMELINE_CELL_WIDTH_STEP,
    timelineCellWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Functions
  function zoomTimelineOut() {
    const newCellWidth = $timelineCellWidth - TIMELINE_CELL_WIDTH_STEP;
    if (newCellWidth < TIMELINE_CELL_MIN_WIDTH) return;
    setTimelineZoom(newCellWidth);
  }

  function zoomTimelineIn() {
    const newCellWidth = $timelineCellWidth + TIMELINE_CELL_WIDTH_STEP;
    if (newCellWidth > TIMELINE_CELL_MAX_WIDTH) return;
    setTimelineZoom(newCellWidth);
  }

  function setTimelineZoom(newCellWidth: number) {
    /** 1. Set a new timeline cell width */
    setTimelineCellWidth(newCellWidth);

    /** 2. Re-calculate framePerScale & rangeRange */
    recalculateFrameRange();
    recalculateFramePerScale();

    /** 3. Then select the first frame as frame range is re-computed */
    selectFirstFrameX();
  }
</script>

<div id="timeline-controller" class="flex items-center gap-2">
  <!-- TIMELINE::ZOOM ADJUSTER::ZOOM OUT -->
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomTimelineOut}>
        <ZoomOutIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      Zoom out
    {/snippet}
  </Tooltips>

  <!-- TIMELINE::ZOOM ADJUSTER::SLIDER -->
  <Slider
    class="min-w-[200px]"
    type="single"
    min={TIMELINE_CELL_MIN_WIDTH}
    max={TIMELINE_CELL_MAX_WIDTH}
    step={TIMELINE_CELL_WIDTH_STEP}
    value={$timelineCellWidth}
    onValueChange={setTimelineZoom}
  ></Slider>

  <!-- TIMELINE::ZOOM ADJUSTER::ZOOM IN -->
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="outline" size="icon-sm" onclick={zoomTimelineIn}>
        <ZoomInIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      Zoom in
    {/snippet}
  </Tooltips>
</div>
