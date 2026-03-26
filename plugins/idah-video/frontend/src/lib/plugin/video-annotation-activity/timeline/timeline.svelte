<script lang="ts">
  import { SquareSplitHorizontalIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext, onMount } from "svelte";

  import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";

  import TimelineCells from "$lib/plugin/video-annotation-activity/timeline/timeline-cells.svelte";
  import TimelineContextMenu, {
    type ITimelineContextMenu,
    type TimelineContextMenuMenu,
  } from "$lib/plugin/video-annotation-activity/timeline/timeline-context-menu.svelte";
  import TimelineHeaderRow from "$lib/plugin/video-annotation-activity/timeline/timeline-header-row.svelte";
  import TimelineRowActions from "$lib/plugin/video-annotation-activity/timeline/timeline-row-actions.svelte";
  import TimelineRowGroup from "$lib/plugin/video-annotation-activity/timeline/timeline-row-group.svelte";
  import TimelineRowHeader from "$lib/plugin/video-annotation-activity/timeline/timeline-row-header.svelte";
  import TimelineRowHeading from "$lib/plugin/video-annotation-activity/timeline/timeline-row-heading.svelte";
  import TimelineRow from "$lib/plugin/video-annotation-activity/timeline/timeline-row.svelte";
  import TimelineRuler from "$lib/plugin/video-annotation-activity/timeline/timeline-ruler.svelte";
  import TimelineVerticalLine from "$lib/plugin/video-annotation-activity/timeline/timeline-vertical-line.svelte";

  import { setCurrentFrame, setSelectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    selectedFrameX,
    selectFirstFrameX,
    setSelectedFrameX,
    TIMELINE_ROW_HEADER_WIDTH,
  } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { getFrameFromMouseX } from "$lib/plugin/video-annotation-activity/timeline/utils";
  import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";
  import { groupAnnotations } from "$lib/plugin/video-annotation-activity/utils/group-annotation.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotations: VideoAnnotationObject[];
    timelineHeight: number;
    onSeekFrame: (frame: number) => void;
    onToggleVisibility: (selectedGroupId?: string) => void;
    onToggleEditability: (selectedGroupId?: string) => void;
    onDeleteAnnotations: (selectedGroupId?: string) => void;
  }
  let {
    annotations,
    timelineHeight,
    onSeekFrame,
    onToggleVisibility,
    onToggleEditability,
    onDeleteAnnotations,
  }: Props = $props();

  // Context
  let context: IActivityContext = getContext("context");

  // Lifecycle
  onMount(() => {
    /** Set selected frame x to timeline row header width (Selected Frame = 1) */
    selectFirstFrameX();
  });

  // Variables
  let timeline: HTMLDivElement;
  let clientMouseX: number = $state(0);
  let annotationGroups = $derived(groupAnnotations(annotations));
  let showVerticalLine = $derived(clientMouseX >= TIMELINE_ROW_HEADER_WIDTH);
  let showSelectedVerticalLine = $derived(Number($selectedFrameX) >= TIMELINE_ROW_HEADER_WIDTH);
  let contextMenu = $state<ITimelineContextMenu>({ visible: false, x: 0, y: 0, menus: {} });

  // Functions
  function getGroupTitle(props: { annotationGroup: AnnotationGroup<VideoAnnotationObject> }): string {
    const { annotationGroup } = props;
    const { groupId, annotations: anns } = annotationGroup;
    const splittedGroupId = groupId.split("-");
    const lastPartOfGroupId = splittedGroupId[splittedGroupId.length - 1];
    const fallbackGroupTitle = `Group-${lastPartOfGroupId}`;

    const firstAnnotationInGroup = anns[0];
    const firstAnnotationCategoryId = firstAnnotationInGroup.value.category;
    if (!firstAnnotationCategoryId) return fallbackGroupTitle;

    const foundCategory = findCategory({
      labelConfig: context.config,
      categoryId: firstAnnotationCategoryId,
      shapeType: firstAnnotationInGroup.shape.type,
    });
    if (!foundCategory) return fallbackGroupTitle;

    return `${foundCategory.label}-${lastPartOfGroupId}`;
  }

  function handleMouseMove(event: MouseEvent) {
    const rect = timeline.getBoundingClientRect();
    clientMouseX = event.clientX - rect.left;
  }

  function selectFrameX(frameX: number) {
    const selectedFrame = getFrameFromMouseX({ clientX: frameX });
    setCurrentFrame(selectedFrame);
    setSelectedFrameX(frameX);
    onSeekFrame(selectedFrame);
    closeContextMenu();
  }

  function closeContextMenu() {
    contextMenu = { visible: false, x: 0, y: 0, menus: {} };
  }

  function showContextMenu(e: MouseEvent, selectAnnotationGroup?: AnnotationGroup<VideoAnnotationObject>) {
    e.preventDefault();

    setSelectedFrameX(e.clientX);

    /** Select annotation group */
    setSelectedAnnotationGroup(selectAnnotationGroup);

    const frame = getFrameFromMouseX({ clientX: e.clientX });

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
    <TimelineRowHeader>
      <TimelineRowHeading class="font-semibold">Annotations</TimelineRowHeading>

      {@const allAnnotationsHidden = annotationGroups.every((annotationGroup) =>
        annotationGroup.annotations.every((annotation) => annotation.hidden),
      )}
      {@const allAnnotationsLocked = annotationGroups.every((annotationGroup) =>
        annotationGroup.annotations.every((annotation) => annotation.locked),
      )}

      <TimelineRowActions
        mode="multiple"
        alwaysShow
        {allAnnotationsHidden}
        {allAnnotationsLocked}
        {onToggleVisibility}
        {onToggleEditability}
        onClickDelete={onDeleteAnnotations}
      />
    </TimelineRowHeader>

    <TimelineRuler onSelectFrameX={selectFrameX} />
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
            onSelectFrameX={selectFrameX}
            onContextMenu={(e) => showContextMenu(e, annotationGroup)}
          >
            <TimelineRowHeader>
              <TimelineRowHeading>
                {getGroupTitle({ annotationGroup })}
              </TimelineRowHeading>

              <TimelineRowActions
                mode="single"
                allAnnotationsHidden={allAnnotationsInGroupHidden}
                allAnnotationsLocked={allAnnotationsInGroupLocked}
                onToggleVisibility={() => onToggleVisibility(annotationGroup.groupId)}
                onToggleEditability={() => onToggleEditability(annotationGroup.groupId)}
                onClickDelete={() => onDeleteAnnotations(annotationGroup.groupId)}
              />
            </TimelineRowHeader>

            <TimelineCells {annotationGroup} />
          </TimelineRowGroup>
        </TimelineRow>
      {/each}
    </div>
  </ScrollArea>

  <!-- Draw a vertical line when mouse move -->
  {#if showVerticalLine}
    <TimelineVerticalLine positionX={clientMouseX} />
  {/if}

  {#if showSelectedVerticalLine}
    <TimelineVerticalLine color="primary" positionX={$selectedFrameX} />
  {/if}
</div>

<TimelineContextMenu {contextMenu} />
