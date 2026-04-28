<script lang="ts">
  import { SearchIcon, SquareSplitHorizontalIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import ConfirmModal from "$lib/components/app/overlays/modals/confirm-modal.svelte";
  import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
  import TimelineCells from "$lib/plugin/video-annotation-activity/timeline/timeline-cells.svelte";
  import TimelineContextMenu, {
    type ITimelineContextMenu,
    type TimelineContextMenuMenu,
  } from "$lib/plugin/video-annotation-activity/timeline/timeline-context-menu.svelte";
  import TimelineEmptyAnnotations from "$lib/plugin/video-annotation-activity/timeline/timeline-empty-annotations.svelte";
  import TimelineHeaderRow from "$lib/plugin/video-annotation-activity/timeline/timeline-header-row.svelte";
  import TimelineHorizontalScrollbar from "$lib/plugin/video-annotation-activity/timeline/timeline-horizontal-scrollbar.svelte";
  import TimelineRowActions from "$lib/plugin/video-annotation-activity/timeline/timeline-row-actions.svelte";
  import TimelineRowGroup from "$lib/plugin/video-annotation-activity/timeline/timeline-row-group.svelte";
  import TimelineRowHeader from "$lib/plugin/video-annotation-activity/timeline/timeline-row-header.svelte";
  import TimelineRowHeading from "$lib/plugin/video-annotation-activity/timeline/timeline-row-heading.svelte";
  import TimelineRowTitle from "$lib/plugin/video-annotation-activity/timeline/timeline-row-title.svelte";
  import TimelineRow from "$lib/plugin/video-annotation-activity/timeline/timeline-row.svelte";
  import TimelineRuler from "$lib/plugin/video-annotation-activity/timeline/timeline-ruler.svelte";
  import TimelineVerticalLine from "$lib/plugin/video-annotation-activity/timeline/timeline-vertical-line.svelte";

  import { DEFAULT_MODE } from "$lib/plugin/type";
  import {
    currentFrame,
    setCurrentFrame,
    setCurrentModeTo,
    totalFrames,
  } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    selectedFrameX,
    setCurrentFrameRange,
    TIMELINE_ROW_HEADER_WIDTH,
  } from "$lib/plugin/video-annotation-activity/timeline/store";
  import {
    getFrameFromMouseX,
    recalculateSelectedFrameXFromCurrentFrame,
  } from "$lib/plugin/video-annotation-activity/timeline/utils";
  import {
    findClosestAnnotationInGroup,
    groupAnnotations,
  } from "$lib/plugin/video-annotation-activity/utils/group-annotation.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup } from "$idah/context/annotation-context";

  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotations: VideoAnnotationObject[];
    annotationFooterHeight: number;

    onSeekFrame: (frame: number) => void;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) => void;
    selectClosestAnnotation: (annotationGroup: AnnotationGroup<VideoAnnotationObject>, frame: number) => void;
  }
  let { annotations, annotationFooterHeight, onSeekFrame, onSelectAnnotationGroup, selectClosestAnnotation }: Props =
    $props();

  // Context
  let context: IActivityContext = getContext("context");

  // Variables
  let timelineEl: HTMLDivElement;
  let timelineScrollAreaHeight = $derived(annotationFooterHeight - 105);
  let clientMouseX: number = $state(0);
  let annotationGroups = $derived(groupAnnotations(annotations));
  let showVerticalLine = $derived(clientMouseX >= TIMELINE_ROW_HEADER_WIDTH);
  let showSelectedVerticalLine = $derived(Number($selectedFrameX) >= TIMELINE_ROW_HEADER_WIDTH);
  let showHorizontalScrollbar = $state<boolean>(false);
  let contextMenu = $state<ITimelineContextMenu>({
    visible: false,
    x: 0,
    y: 0,
    menus: {},
  });
  let wheelThrottling = $state<boolean>(false);
  let openConfirmDeleteModal = $state<boolean>(false);
  let selectedGroupId = $state<string | undefined>(undefined);

  function handleMouseLeave() {
    showHorizontalScrollbar = false;
    showVerticalLine = false;
  }

  function handleMouseMove(event: MouseEvent) {
    const rect = timelineEl.getBoundingClientRect();
    clientMouseX = event.clientX - rect.left;
  }

  function scrollRight(shiftRangeSpan: number) {
    const [start, end] = $currentFrameRange;
    const rangeSpan = end - start;

    let newEnd = end + shiftRangeSpan;
    if (newEnd > $totalFrames) newEnd = $totalFrames;

    const newStart = newEnd - rangeSpan;

    setCurrentFrameRange([newStart, newEnd]);
    recalculateSelectedFrameXFromCurrentFrame();
  }

  function scrollLeft(shiftRangeSpan: number) {
    const [start, end] = $currentFrameRange;
    const rangeSpan = end - start;

    let newStart = start - shiftRangeSpan;
    if (newStart < 0) newStart = 0;

    let newEnd = newStart + rangeSpan;
    if (newEnd > $totalFrames) newEnd = $totalFrames;

    setCurrentFrameRange([newStart, newEnd]);
    recalculateSelectedFrameXFromCurrentFrame();
  }

  function scrollTimelineHorizontal(e: WheelEvent) {
    const isScrollUp = e.deltaX < 0;
    const isScrollDown = e.deltaX > 0;
    const shiftRangeSpan = 1;

    if (isScrollUp) return scrollRight(shiftRangeSpan);
    if (isScrollDown) return scrollLeft(shiftRangeSpan);
  }

  // function zoomIn() {
  //   setTimelineCellWidth($timelineCellWidth + TIMELINE_CELL_WIDTH_STEP);
  // }

  // function zoomOut() {
  //   setTimelineCellWidth($timelineCellWidth - TIMELINE_CELL_WIDTH_STEP);
  // }

  // function zoomTimeline(e: WheelEvent) {
  //   const isScrollUp = e.deltaY < 0;
  //   const isScrollDown = e.deltaY > 0;

  //   if (isScrollUp) return zoomIn();
  //   if (isScrollDown) return zoomOut();
  // }

  function handleTimelineWheel(e: WheelEvent) {
    if (!wheelThrottling) {
      wheelThrottling = true;
      setTimeout(() => (wheelThrottling = false), 10);

      if (e.shiftKey) {
        scrollTimelineHorizontal(e);
      }

      if (e.metaKey) {
        // zoomTimeline(e);
      }

      // Check if user scroll horizontal by mouse or track pad
      // if (e.deltaX !== 0) {
      //   scrollTimelineHorizontal(e);
      // }
    }
  }

  function selectFrameX(frameX: number) {
    const frame = getFrameFromMouseX({ clientX: frameX });
    const selectedFrame = Math.min(frame, $totalFrames);

    const [startFrameIndexOfCurrentFrameRange, _] = $currentFrameRange;
    const scaledStartFrameIndexOfCurrentFrameRange = Number(startFrameIndexOfCurrentFrameRange * $framePerScale);

    setCurrentFrame(selectedFrame + scaledStartFrameIndexOfCurrentFrameRange);
    onSeekFrame(selectedFrame + scaledStartFrameIndexOfCurrentFrameRange);

    /**
     * Note: Do not setSelectedFrameX here
     * If you want to setSelectedFrameX, set it on timeline-ruler.svelte inside $effect runes.
     */

    closeContextMenu();
  }

  function closeContextMenu() {
    contextMenu = { visible: false, x: 0, y: 0, menus: {} };
  }

  function showContextMenu(e: MouseEvent, selectAnnotationGroup: AnnotationGroup<VideoAnnotationObject>) {
    e.preventDefault();

    /** (If UX need to select annotation group & set selected vertical line on context menu) Select annotation group */
    // setSelectedFrameX(e.clientX);
    // setSelectedAnnotationGroup(selectAnnotationGroup);

    const scaledFrame = getFrameFromMouseX({ clientX: e.clientX });
    const [startFrameIndexOfCurrentFrameRange, _] = $currentFrameRange;
    const scaledStartFrameIndexOfCurrentFrameRange = Number(startFrameIndexOfCurrentFrameRange * $framePerScale);
    const displayScaledFrame = scaledFrame + scaledStartFrameIndexOfCurrentFrameRange;

    /** Closest annotation */
    const closestAnnotation = findClosestAnnotationInGroup({
      annotationGroup: selectAnnotationGroup,
      frame: displayScaledFrame,
    });

    /** Menus */
    const seekToFrameMenu: TimelineContextMenuMenu = {
      label: `Seek to frame ${displayScaledFrame}`,
      icon: SearchIcon,
      onClick: () => {
        onSeekFrame(displayScaledFrame);
        closeContextMenu();
      },
    };

    const splitMenu: TimelineContextMenuMenu = {
      label: `Split at frame ${displayScaledFrame}`,
      icon: SquareSplitHorizontalIcon,
      disabled: closestAnnotation.locked,
      onClick: () => {
        context.commands.run("annotation.split", {
          id: closestAnnotation.metadata.id,
          at: displayScaledFrame,
        });
        closeContextMenu();
      },
    };

    const deleteInterpolationMenu: TimelineContextMenuMenu = {
      label: `Delete frame ${displayScaledFrame}`,
      icon: Trash2Icon,
      disabled: closestAnnotation.locked,
      onClick: () => {
        context.commands.run("keyframe.delete", {
          annotationId: closestAnnotation.metadata.id,
          frame: displayScaledFrame,
        });

        closeContextMenu();
      },
    };

    const deleteAnnotationMenu: TimelineContextMenuMenu = {
      label: "Delete annotation",
      icon: Trash2Icon,
      onClick: () => {
        context.commands.run("annotation.delete", {
          annotationId: closestAnnotation.metadata.id,
        });

        selectAnnotationGroup.annotations = selectAnnotationGroup.annotations.filter(
          (annotation) => annotation.metadata.id !== closestAnnotation.metadata.id,
        );

        if (selectAnnotationGroup.annotations.length > 0) {
          /** Select the new closest annotation after filter the deleted annotation */
          selectClosestAnnotation(selectAnnotationGroup, $currentFrame);
        } else {
          context.commands.run("tools.reset");
        }

        closeContextMenu();
      },
    };

    /** Set contextMenu.menus based on selected annotation group */
    contextMenu = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      menus: {
        frameRelatedMenu: {
          items: [],
        },
        annotationMenu: {
          items: [],
        },
      },
    };

    /** Only show split menu, if selected frame is in the closest  */
    const closestAnnotationKeyFrames = closestAnnotation.shape.frames.map((f) => f.frame);
    const sortedClosestAnnotationKeyFrames = closestAnnotationKeyFrames.sort((a, b) => a - b);

    const isSelectedFrameInKeyFrames = sortedClosestAnnotationKeyFrames.some((f, i) => {
      if (i === sortedClosestAnnotationKeyFrames.length - 1) return false;
      const next = sortedClosestAnnotationKeyFrames[i + 1];

      return displayScaledFrame >= f && displayScaledFrame <= next;
    });

    if (isSelectedFrameInKeyFrames) {
      contextMenu.menus.frameRelatedMenu.items.push(seekToFrameMenu, splitMenu);
    }

    /** Only show delete menu, if selected frame is in the range of keyframes of the closest annotation */
    if (
      closestAnnotationKeyFrames[closestAnnotationKeyFrames.length - 1] >= displayScaledFrame &&
      closestAnnotationKeyFrames[0] <= displayScaledFrame
    ) {
      contextMenu.menus.annotationMenu.items.push(deleteAnnotationMenu);
    }

    /**
     * Only show delete interpolation menu;
     * - If selected annotations have keyframe at selected frame
     * - If annotation have more than 1 key frames
     *  */
    const closestAnnotationHaveMoreThanOneKeyFrame = sortedClosestAnnotationKeyFrames.length > 1;
    const hasInterpolationAtFrame =
      closestAnnotation.shape.frames.filter((f) => f.frame === displayScaledFrame).length > 0;

    if (hasInterpolationAtFrame && closestAnnotationHaveMoreThanOneKeyFrame) {
      contextMenu.menus.frameRelatedMenu.items.push(deleteInterpolationMenu);
    }

    const frameRelatedMenus = contextMenu.menus.frameRelatedMenu.items.length;
    const annotationMenus = contextMenu.menus.annotationMenu.items.length;

    contextMenu.visible = frameRelatedMenus + annotationMenus >= 1;
  }

  function toggleAllAnnotationsVisibility() {
    context.commands.run("annotation.toggleAllVisibility");
  }

  function toggleAllAnnotationsEditability() {
    context.commands.run("annotation.toggleAllEditability");
  }

  function deleteAllAnnotations() {
    context.commands.run("annotation.deleteAll");
  }

  function toggleAnnotationGroupVisibility(groupId: string) {
    context.commands.run("annotation.toggleGroupVisibility", { groupId });
  }

  function toggleAnnotationGroupEditability(groupId: string) {
    context.commands.run("annotation.toggleGroupEditability", { groupId });
  }

  function deleteAnnotationGroup(groupId: string) {
    context.commands.run("annotation.deleteGroup", { groupId });
  }

  function showConfirmDeleteModal(groupId?: string) {
    selectedGroupId = groupId;
    openConfirmDeleteModal = true;
  }
</script>

<div
  class="timeline-container"
  role="document"
  onmousemove={handleMouseMove}
  onmouseenter={() => (showHorizontalScrollbar = true)}
  onmouseleave={handleMouseLeave}
>
  <div id="timeline" bind:this={timelineEl} class="relative w-full max-w-screen">
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
          onToggleVisibility={toggleAllAnnotationsVisibility}
          onToggleEditability={toggleAllAnnotationsEditability}
          onClickDelete={showConfirmDeleteModal}
        />
      </TimelineRowHeader>

      <TimelineRuler {annotations} onSelectFrameX={selectFrameX} {onSelectAnnotationGroup} />
    </TimelineHeaderRow>

    <ScrollArea id="timeline-scroll-area">
      <section style:height="{timelineScrollAreaHeight}px" onwheel={handleTimelineWheel}>
        {#each annotationGroups as annotationGroup (annotationGroup.groupId)}
          {@const allAnnotationsInGroupHidden = annotationGroup.annotations.every((annotation) => annotation.hidden)}
          {@const allAnnotationsInGroupLocked = annotationGroup.annotations.every((annotation) => annotation.locked)}

          <TimelineRow>
            <TimelineRowGroup
              class="border-t border-b"
              {annotationGroup}
              onSelectFrameX={selectFrameX}
              onContextMenu={(e) => showContextMenu(e, annotationGroup)}
              {onSelectAnnotationGroup}
            >
              <TimelineRowHeader>
                <TimelineRowHeading>
                  <TimelineRowTitle {annotationGroup}></TimelineRowTitle>
                </TimelineRowHeading>

                <TimelineRowActions
                  mode="single"
                  allAnnotationsHidden={allAnnotationsInGroupHidden}
                  allAnnotationsLocked={allAnnotationsInGroupLocked}
                  onToggleVisibility={() => toggleAnnotationGroupVisibility(annotationGroup.groupId)}
                  onToggleEditability={() => toggleAnnotationGroupEditability(annotationGroup.groupId)}
                  onClickDelete={() => showConfirmDeleteModal(annotationGroup.groupId)}
                />
              </TimelineRowHeader>

              <TimelineCells {annotationGroup} />
            </TimelineRowGroup>
          </TimelineRow>
        {:else}
          <TimelineEmptyAnnotations />
        {/each}
      </section>

      <section id="timeline-horizontal-scrollbar-container">
        {#if showHorizontalScrollbar}
          <TimelineHorizontalScrollbar />
        {/if}
      </section>
    </ScrollArea>

    <!-- Draw a vertical line when mouse move -->
    {#if showVerticalLine}
      <TimelineVerticalLine positionX={clientMouseX} />
    {/if}

    {#if showSelectedVerticalLine}
      <TimelineVerticalLine color="primary" positionX={$selectedFrameX} />
    {/if}
  </div>
</div>

<TimelineContextMenu {contextMenu} onCloseContextMenu={closeContextMenu} />

<ConfirmModal
  title="Delete {selectedGroupId ? 'annotation group' : 'all annotations'}"
  description="Are you sure you want to delete {selectedGroupId ? 'this annotation group' : 'all annotations'}?"
  onConfirm={() => {
    if (selectedGroupId) {
      deleteAnnotationGroup(selectedGroupId);
      selectedGroupId = undefined;
    } else {
      deleteAllAnnotations();
    }

    // Return to default mode after deletion
    setCurrentModeTo(DEFAULT_MODE);
    openConfirmDeleteModal = false;
  }}
  bind:open={openConfirmDeleteModal}
/>
