<script lang="ts">
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";

  import Timeline from "./components/timeline.svelte";
  import VideoController from "./components/video-controller.svelte";

  // Variables
  let timelineHeight: number = $state(0);

  // Variables::Timeline Cell
  const timelineRowHeaderWidth: number = 320;
  const timelineCellMinWidth: number = 10;
  const timelineCellMaxWidth: number = 60;

  let timelineCellWidth: number = $state(25);
  let selectedFrameX: number = $state(0);

  // Functions
  function onTimelineResize(resizeValue: number) {
    timelineHeight = window.innerHeight * (resizeValue / 100);
  }

  function setTimelineCellWidth(value: number) {
    timelineCellWidth = value;

    /** Deselect frame x when timeline cell width changes */
    selectFrameX(0);
  }

  function selectFrameX(frameX: number) {
    selectedFrameX = frameX;
  }

  function toggleVisibility(selectedGroupId?: string) {
    if (selectedGroupId) {
      /** Toggle visibility of annotations in selected group */
      console.log(`Toggle visibility of annotations in groupId: ${selectedGroupId}`);
    } else {
      /** Toggle visibility of all annotations */
      console.log(`Toggle visibility of all annotations`);
    }
  }

  function toggleEditability(selectedGroupId?: string) {
    if (selectedGroupId) {
      /** Toggle editability of annotations in selected group */
      console.log(`Toggle editability of annotations in groupId: ${selectedGroupId}`);
    } else {
      /** Toggle lock/unlock all annotations */
      console.log(`Toggle lock/unlock all annotations`);
    }
  }

  function deleteAnnotations(selectedGroupId?: string) {
    if (selectedGroupId) {
      /** Delete all annotations in selected group */
      console.log(`Delete all annotations in groupId: ${selectedGroupId}`);
    } else {
      /** Delete all annotations */
      console.log(`Delete all annotations`);
    }
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

      <Timeline
        {timelineHeight}
        {timelineRowHeaderWidth}
        {timelineCellWidth}
        {selectedFrameX}
        onSelectFrameX={selectFrameX}
        onToggleVisibility={toggleVisibility}
        onToggleEditability={toggleEditability}
        onDeleteAnnotations={deleteAnnotations}
      />
    </ResizablePane>
  </ResizablePaneGroup>
</main>
