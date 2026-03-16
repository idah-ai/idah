<script lang="ts">
  import { SquareSplitHorizontalIcon, Trash2Icon } from "@lucide/svelte";

  import ScrollArea from "@/components/ui/scroll-area/scroll-area.svelte";

  import TimelineCells from "./timeline-cells.svelte";
  import TimelineContextMenu, {
    type ITimelineContextMenu,
    type TimelineContextMenuMenu,
  } from "./timeline-context-menu.svelte";
  import TimelineHeaderRow from "./timeline-header-row.svelte";
  import TimelineRowActions from "./timeline-row-actions.svelte";
  import TimelineRowGroup from "./timeline-row-group.svelte";
  import TimelineRowHeader from "./timeline-row-header.svelte";
  import TimelineRowHeading from "./timeline-row-heading.svelte";
  import TimelineRow from "./timeline-row.svelte";
  import TimelineRuler from "./timeline-ruler.svelte";
  import VerticalLine from "./vertical-line.svelte";

  import { groupAnnotations } from "../../../plugins/idah-video/video-annotation-activity/group-annotation.svelte";
  import { selectedAnnotationGroup } from "../../../plugins/idah-video/video-annotation-activity/store";
  import { annotations, type AnnotationObject } from "../data/annotations";
  import { getFrameFromMouseX } from "./utils";

  import type { AnnotationGroup } from "@/context/AnnotationContext";

  // Props
  interface Props {
    timelineHeight: number;
    timelineRowHeaderWidth: number;
    timelineCellWidth: number;
    selectedFrameX: number;
    onSelectFrameX: (frameX: number) => void;
    onToggleVisibility: (selectedGroupId?: string) => void;
    onToggleEditability: (selectedGroupId?: string) => void;
    onDeleteAnnotations: (selectedGroupId?: string) => void;
  }
  let {
    timelineHeight,
    timelineRowHeaderWidth,
    timelineCellWidth,
    selectedFrameX,
    onSelectFrameX,
    onToggleVisibility,
    onToggleEditability,
    onDeleteAnnotations,
  }: Props = $props();

  // Variables
  let timeline: HTMLDivElement;
  let clientMouseX: number = $state(0);
  let annotationGroups = groupAnnotations(annotations);
  let showVerticalLine = $derived(clientMouseX >= timelineRowHeaderWidth);
  let showSelectedVerticalLine = $derived(Number(selectedFrameX) >= timelineRowHeaderWidth);
  let contextMenu = $state<ITimelineContextMenu>({ visible: false, x: 0, y: 0, menus: {} });

  // Functions
  function handleMouseMove(event: MouseEvent) {
    const rect = timeline.getBoundingClientRect();
    clientMouseX = event.clientX - rect.left;
  }

  function selectFrameX(frameX: number) {
    onSelectFrameX(frameX);
    closeContextMenu();
  }

  function closeContextMenu() {
    contextMenu = { visible: false, x: 0, y: 0, menus: {} };
  }

  function showContextMenu(e: MouseEvent, selectAnnotationGroup?: AnnotationGroup<AnnotationObject>) {
    e.preventDefault();

    /** Select annotation group ?*/
    $selectedAnnotationGroup = selectAnnotationGroup;

    const frame = getFrameFromMouseX({ clientX: e.clientX, timelineRowHeaderWidth, timelineCellWidth });

    /** Menus */
    const splitMenu: TimelineContextMenuMenu = {
      label: `Split at frame ${frame}`,
      icon: SquareSplitHorizontalIcon,
      disabled: false, // TODO:: annotation.locked
      onClick: () => {
        closeContextMenu();
        // context.commands.run("annotation.split", { id: annotation?.metadata.id, at: frame })
      },
    };

    const deleteInterpolationMenu: TimelineContextMenuMenu = {
      label: `Delete frame ${frame}`,
      icon: Trash2Icon,
      disabled: false, // TODO:: annotation.locked
      onClick: () => {
        closeContextMenu();
        // context.commands.run("annotation.deleteInterpolation", { id: annotation?.metadata.id, at: frame })
      },
    };

    const deleteAnnotationMenu: TimelineContextMenuMenu = {
      label: "Delete annotation",
      icon: Trash2Icon,
      onClick: () => {
        closeContextMenu();
        // context.commands.run("annotation.delete", { id: annotation?.metadata.id })
      },
    };

    /** Set contextMenu.menus based on selected annotation group */
    contextMenu = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      menus: {
        frameRelatedMenu: {
          items: [splitMenu, deleteInterpolationMenu],
        },
        annotationMenu: {
          items: [deleteAnnotationMenu],
        },
      },
    };
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

      {@const allAnnotationsHidden = annotationGroups.every((annotationGroup) =>
        annotationGroup.annotations.every((annotation) => annotation.hidden),
      )}
      {@const allAnnotationsLocked = annotationGroups.every((annotationGroup) =>
        annotationGroup.annotations.every((annotation) => annotation.locked),
      )}

      <TimelineRowActions
        alwaysShow
        {allAnnotationsHidden}
        {allAnnotationsLocked}
        {onToggleVisibility}
        {onToggleEditability}
        onClickDelete={onDeleteAnnotations}
      />
    </TimelineRowHeader>

    <TimelineRuler {timelineCellWidth} onSelectFrameX={selectFrameX} />
  </TimelineHeaderRow>

  <ScrollArea>
    <div style:height="{timelineHeight - 96}px">
      {#each annotationGroups as annotationGroup (annotationGroup.groupId)}
        {@const allAnnotationsInGroupHidden = annotationGroup.annotations.every((annotation) => annotation.hidden)}
        {@const allAnnotationsInGroupLocked = annotationGroup.annotations.every((annotation) => annotation.locked)}

        <TimelineRow>
          <TimelineRowGroup
            class="border-b"
            {annotationGroup}
            {timelineCellWidth}
            onSelectFrameX={selectFrameX}
            onContextMenu={(e) => showContextMenu(e, annotationGroup)}
          >
            <TimelineRowHeader width={timelineRowHeaderWidth}>
              <TimelineRowHeading>
                {annotationGroup.groupId}
              </TimelineRowHeading>

              <TimelineRowActions
                allAnnotationsHidden={allAnnotationsInGroupHidden}
                allAnnotationsLocked={allAnnotationsInGroupLocked}
                onToggleVisibility={() => onToggleVisibility(annotationGroup.groupId)}
                onToggleEditability={() => onToggleEditability(annotationGroup.groupId)}
                onClickDelete={() => onDeleteAnnotations(annotationGroup.groupId)}
              />
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

<TimelineContextMenu {contextMenu} />
