<script lang="ts">
  import { ZoomInIcon, ZoomOutIcon } from "@lucide/svelte";

  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Slider from "$lib/components/ui/slider/slider.svelte";

  import type { Viewport } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Props
  interface Props {
    viewport: Viewport;
    length: number;
    onViewportChange: (viewport: Viewport) => void;
  }
  let { viewport, length, onViewportChange }: Props = $props();

  // Variables
  let zoomLevel = $derived(length / (viewport.endRange - viewport.startRange));
  let displayZoomLevel = $derived<number>(Math.max(1, Math.min(40, zoomLevel)));
  // let zoomLevel = $state<number>(1);

  // Functions
  function zoomTimelineOut() {
    // const newCellWidth = $timelineCellWidth - TIMELINE_CELL_WIDTH_STEP;
    // if (newCellWidth < TIMELINE_CELL_MIN_WIDTH) return;
    // setTimelineZoom(newCellWidth);
  }

  function zoomTimelineIn() {
    // const newCellWidth = $timelineCellWidth + TIMELINE_CELL_WIDTH_STEP;
    // if (newCellWidth > TIMELINE_CELL_MAX_WIDTH) return;
    // setTimelineZoom(newCellWidth);
  }

  function applyZoom(newZoom: number) {
    // Keep the center of current viewport when zooming
    // TODO: Need to calculate from the hovered / selection caret instead of the center of viewport
    const centerOfViewport = (viewport.startRange + viewport.endRange) / 2;
    const newRange = length / newZoom;

    let newStart = centerOfViewport - newRange / 2;
    let newEnd = centerOfViewport + newRange / 2;

    // Clamp within [0, length]
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }

    if (newEnd > length) {
      newEnd = length;
      newStart = length - newRange;
    }

    onViewportChange({ startRange: newStart, endRange: newEnd });
  }
</script>

<div id="timeline-controller" class="flex items-center gap-2">
  <!-- TIMELINE::ZOOMADJUSTER::ZOOM OUT -->
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
    min={1}
    max={40}
    step={0.1}
    value={displayZoomLevel}
    onValueChange={applyZoom}
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
