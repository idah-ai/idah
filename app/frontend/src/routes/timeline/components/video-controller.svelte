<script lang="ts">
  import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    PlayIcon,
    Volume2Icon,
    ZoomInIcon,
    ZoomOutIcon,
  } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Slider from "@/components/ui/slider/slider.svelte";

  // Props
  interface Props {
    timelineCellMinWidth: number;
    timelineCellWidth: number;
    timelineCellMaxWidth: number;
    onZoomChange: (zoomValue: number) => void;
  }
  let { timelineCellMinWidth, timelineCellWidth, timelineCellMaxWidth, onZoomChange }: Props = $props();

  // Variables
  const timelineCellWidthStep = 5;

  // Functions
  function zoomTimelineOut() {
    onZoomChange(timelineCellWidth - timelineCellWidthStep);
  }

  function zoomTimelineIn() {
    onZoomChange(timelineCellWidth + timelineCellWidthStep);
  }
</script>

<nav class="flex items-center gap-2 border-b p-2">
  <Button variant="outline" size="icon-sm">
    <ChevronsLeftIcon />
  </Button>

  <Button variant="outline" size="icon-sm">
    <ChevronLeftIcon />
  </Button>

  <Button variant="outline" size="icon-sm">
    <PlayIcon />
  </Button>

  <Button variant="outline" size="icon-sm">
    <ChevronRightIcon />
  </Button>

  <Button variant="outline" size="icon-sm">
    <ChevronsRightIcon />
  </Button>

  <Button variant="outline" size="icon-sm">
    <Volume2Icon />
  </Button>

  <div class="ml-auto flex items-center gap-2">
    <Button variant="outline" size="icon-sm" onclick={zoomTimelineOut}>
      <ZoomOutIcon />
    </Button>

    <Slider
      class="min-w-[200px]"
      type="single"
      min={timelineCellMinWidth}
      max={timelineCellMaxWidth}
      step={timelineCellWidthStep}
      value={timelineCellWidth}
      onValueChange={onZoomChange}
    ></Slider>

    <Button variant="outline" size="icon-sm" onclick={zoomTimelineIn}>
      <ZoomInIcon />
    </Button>
  </div>
</nav>
