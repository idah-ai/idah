<script lang="ts">
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
  import Timeline from "./components/timeline.svelte";
  import VideoController from "./components/video-controller.svelte";

  // Variables
  let timelineHeight: number = $state(0);

  // Variables::Timeline Cell
  const timelineCellMinWidth: number = 25;
  let timelineCellWidth: number = $state(50);
  const timelineCellMaxWidth: number = 80;

  // Functions
  function onTimelineResize(resizeValue: number) {
    timelineHeight = window.innerHeight * (resizeValue / 100);
  }

  function setTimelineCellWidth(value: number) {
    timelineCellWidth = value;
    console.log({ timelineCellWidth });
  }
</script>

<main id="annotation-activity" class="flex h-screen flex-col">
  <header class="flex h-12 items-center border-b"></header>

  <ResizablePaneGroup direction="vertical" class="flex h-full flex-1">
    <ResizablePane defaultSize={75}>
      <section id="plugin-container" class="flex h-full flex-1">
        <div id="left-sidebar" class="flex w-80 items-center justify-center border-r bg-gray-200">Left Sidebar</div>

        <div id="main-content" class="flex flex-1 items-center justify-center bg-gray-400">Video</div>

        <div id="right-sidebar" class="flex w-80 items-center justify-center border-l bg-gray-200">Right Sidebar</div>
      </section>
    </ResizablePane>

    <ResizableHandle withHandle />

    <ResizablePane defaultSize={25} onResize={onTimelineResize}>
      <VideoController
        {timelineCellMinWidth}
        {timelineCellWidth}
        {timelineCellMaxWidth}
        onZoomChange={setTimelineCellWidth}
      />

      <Timeline {timelineHeight} {timelineCellWidth} />
    </ResizablePane>
  </ResizablePaneGroup>
</main>
