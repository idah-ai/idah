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

  import { groupAnnotations } from "../../../plugins/idah-video/video-annotation-activity/group-annotation.svelte";
  import { annotations } from "../data/annotations";

  // Props
  interface Props {
    timelineHeight: number;
    timelineCellWidth: number;
  }
  let { timelineHeight, timelineCellWidth }: Props = $props();

  // Variables
  let annotationGroups = groupAnnotations(annotations);
</script>

<div id="timeline" class="w-full max-w-screen">
  <TimelineHeaderRow>
    <TimelineRowHeader>
      <TimelineRowHeading class="font-semibold">Annotations</TimelineRowHeading>

      <TimelineRowActions alwaysShow />
    </TimelineRowHeader>

    <TimelineRuler {timelineCellWidth}></TimelineRuler>
  </TimelineHeaderRow>

  <ScrollArea>
    <div style:height="{timelineHeight - 90}px">
      {#each annotationGroups as annotationGroup (annotationGroup.groupId)}
        <TimelineRow>
          <TimelineRowGroup class="border-b" {annotationGroup} {timelineCellWidth}>
            <TimelineRowHeader>
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
</div>
