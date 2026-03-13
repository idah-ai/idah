<script lang="ts">
  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";

  import TimelineCells from "./timeline-cells.svelte";
  import TimelineHeaderRow from "./timeline-header-row.svelte";
  import TimelineRowActions from "./timeline-row-actions.svelte";
  import TimelineRowGroup from "./timeline-row-group.svelte";
  import TimelineRowHeader from "./timeline-row-header.svelte";
  import TimelineRowHeading from "./timeline-row-heading.svelte";
  import TimelineRow from "./timeline-row.svelte";
  import TimelineRuler from "./timeline-ruler.svelte";
  import VerticalLine from "./vertical-line.svelte";

  import { groupAnnotations } from "../../../plugins/idah-video/video-annotation-activity/group-annotation.svelte";
  import { annotations } from "../data/annotations";

  // Props
  interface Props {
    timelineHeight: number;
    timelineCellWidth: number;
    selectedFrameX: number;
    onSelectFrameX: (frameX: number) => void;
  }
  let { timelineHeight, timelineCellWidth, selectedFrameX, onSelectFrameX }: Props = $props();

  // Variables
  const timelineRowHeaderWidth: number = 320;

  let timeline: HTMLDivElement;
  let clientMouseX: number = $state(0);
  let annotationGroups = groupAnnotations(annotations);
  let showVerticalLine = $derived(clientMouseX >= timelineRowHeaderWidth);
  let showSelectedVerticalLine = $derived(Number(selectedFrameX) >= timelineRowHeaderWidth);

  // Functions
  function handleMouseMove(event: MouseEvent) {
    const rect = timeline.getBoundingClientRect();
    clientMouseX = event.clientX - rect.left;
  }
</script>

<div
  id="timeline"
  role="document"
  bind:this={timeline}
  class="relative w-full max-w-screen"
  onmousemove={handleMouseMove}
  onmouseleave={() => (showVerticalLine = false)}
>
  <TimelineHeaderRow>
    <TimelineRowHeader width={timelineRowHeaderWidth}>
      <TimelineRowHeading class="font-semibold">Annotations</TimelineRowHeading>

      <TimelineRowActions alwaysShow />
    </TimelineRowHeader>

    <TimelineRuler {timelineCellWidth} {onSelectFrameX} />
  </TimelineHeaderRow>

  <ScrollArea>
    <div style:height="{timelineHeight - 90}px">
      {#each annotationGroups as annotationGroup (annotationGroup.groupId)}
        <TimelineRow>
          <TimelineRowGroup class="border-b" {annotationGroup} {timelineCellWidth} {onSelectFrameX}>
            <TimelineRowHeader width={timelineRowHeaderWidth}>
              <TimelineRowHeading>
                {annotationGroup.groupId}
              </TimelineRowHeading>
              <TimelineRowActions />
            </TimelineRowHeader>

            <TimelineCells {annotationGroup} {timelineCellWidth} />
          </TimelineRowGroup>
        </TimelineRow>
      {/each}
    </div>
  </ScrollArea>

  <!-- Draw a vertical line when mouse move -->
  {#if showVerticalLine}
    <VerticalLine positionX={clientMouseX} {timelineRowHeaderWidth} {timelineCellWidth} />
  {/if}

  {#if showSelectedVerticalLine}
    <VerticalLine color="primary" positionX={selectedFrameX} {timelineRowHeaderWidth} {timelineCellWidth} />
  {/if}
</div>
