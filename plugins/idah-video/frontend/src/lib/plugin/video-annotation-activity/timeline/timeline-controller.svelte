<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Slider from "$lib/components/ui/slider/slider.svelte";

  import {
    selectFirstFrameX,
    setTimelineCellWidth,
    timelineCellWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Variables
  const timelineCellWidthStep = 5;
  const timelineCellMinWidth: number = 10; // Unit: px
  const timelineCellMaxWidth: number = 60; // Unit: px

  // Functions
  function zoomTimelineOut() {
    const newTimelineCellWidth = $timelineCellWidth - timelineCellWidthStep;
    if (newTimelineCellWidth < timelineCellMinWidth) return;
    setTimelineCellWidth(newTimelineCellWidth);
  }

  function zoomTimelineIn() {
    const newTimelineCellWidth = $timelineCellWidth + timelineCellWidthStep;
    if (newTimelineCellWidth > timelineCellMaxWidth) return;
    setTimelineCellWidth(newTimelineCellWidth);
  }

  function setTimelineZoom(value: number) {
    setTimelineCellWidth(value);
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
    min={timelineCellMinWidth}
    max={timelineCellMaxWidth}
    step={timelineCellWidthStep}
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
