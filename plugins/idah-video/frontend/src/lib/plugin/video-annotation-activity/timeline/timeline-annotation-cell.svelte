<script lang="ts">
  import { getContext } from "svelte";

  import { selectedAnnotation } from "$lib/plugin/video-annotation-activity/store/store";
  import {
    currentFrameRange,
    framePerScale,
    timelineCellWidth,
  } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";

  import type {
    IActivityContext,
    IConfigValue,
  } from "$idah/context/activity-context";
  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
    frameRanges: number[];
  }
  let { annotationGroup, frameRanges }: Props = $props();

  // Context
  let context: IActivityContext = getContext("context");

  // Variables
  let { groupId } = $derived(annotationGroup);

  /** Overall height of annotation in px */
  const annotationHeight = 24;

  /** The first frame index of current frame range (0-based), e.g. [0, 48] will return 0 */
  let startFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[0]);

  /** The last frame index of current frame range (0-based), e.g. [0, 48] will return 48 */
  let endFrameIndexOfCurrentFrameRange = $derived($currentFrameRange[1]);

  /** The first frame of current frame range (1-based), e.g. [0, 48] will return 1 */
  let startFrameOfCurrentFrameRange = $derived(
    startFrameIndexOfCurrentFrameRange + 1,
  );

  /** The last frame of current frame range (1-based), e.g. [0, 48] will return 49 */
  let endFrameOfCurrentFrameRange = $derived(
    endFrameIndexOfCurrentFrameRange + 1,
  );

  /** The count of frame ranges */
  let rangeLength = $derived(frameRanges.length);

  /** The first frame of the first frame range, e.g. [1, 9, 10] will return 1 */
  let startFrameOfGroup = $derived(frameRanges[0]);

  /** The last frame of the last frame range, e.g. [1, 9, 10] will return 10 */
  let endFrameOfGroup = $derived(frameRanges[rangeLength - 1]);

  /**
   * The frame ranges that are within the current frame span
   * If the frame is outside the current frame span, it will be null
   * Example 1: frameRanges = [1, 9, 10] / [11, 18, 20] and currentFrameRange = [0, 48]
   * transformedFrameRanges should be [1, 9, 10] / [11, 18, 20]
   *
   * Example 2: frameRanges = [1, 9, 10] / [11, 18, 20] and currentFrameRange = [18, 66]
   * transformedFrameRanges should be [null, null, null] / [null, 20, 21]
   */
  let transformedFrameRanges = $derived.by(() => {
    return frameRanges.map((eachFrame) => {
      /** If each frame in frame ranges is greater than the scaled end frame of current frame range */
      if (eachFrame >= startFrameIndexOfCurrentFrameRange * $framePerScale) {
        return eachFrame;
      }

      /** If each frame in frame ranges is less than the scaled start frame of current frame range */
      if (eachFrame < startFrameOfCurrentFrameRange * $framePerScale) {
        return null;
      }

      /** If each frame in frame ranges is within the scaled current frame range */
      if (
        eachFrame >= startFrameOfCurrentFrameRange * $framePerScale &&
        eachFrame <= endFrameOfCurrentFrameRange * $framePerScale
      ) {
        return eachFrame;
      }

      /** If each frame in frame ranges is greater than the scaled end frame of current frame range */
      if (
        eachFrame >= startFrameOfCurrentFrameRange * $framePerScale &&
        eachFrame >= endFrameOfCurrentFrameRange * $framePerScale
      ) {
        return eachFrame;
      }

      /** If each frame in frame ranges is greater than the end frame of current frame range */
      if (eachFrame > endFrameOfCurrentFrameRange * $framePerScale) {
        return null;
      }
    });
  });

  let scaledTransformedFrameRanges = $derived.by(() => {
    return transformedFrameRanges.map((frame) => {
      if (!frame) return null;
      return Math.max(1, Math.floor(frame / $framePerScale));
    });
  });
  let notNullScaledTransformedFrameRanges = $derived(
    scaledTransformedFrameRanges.filter((frame) => frame !== null),
  );
  let scaledTransformedRangeLength = $derived(
    scaledTransformedFrameRanges.length,
  );
  let startOfScaledTransformedRange = $derived(scaledTransformedFrameRanges[0]);
  let endOfScaledTransformedRange = $derived(
    scaledTransformedFrameRanges[scaledTransformedRangeLength - 1],
  );
  let scaledTransformedRangeStyle = $derived.by(() => {
    let width: number = 0;
    let left: number = 0;
    let showBorderLeft: boolean = true;
    let showBorderRight: boolean = true;
    let borderRadiusLeft: number = 0;
    let borderRadiusRight: number = 0;

    /** No frame to display in current frame span */
    if (!startOfScaledTransformedRange && !endOfScaledTransformedRange) {
      return {
        width,
        left,
        showBorderLeft,
        showBorderRight,
        borderRadiusLeft,
        borderRadiusRight,
      };
    }

    /** Have start frame in current frame span, but no end frame in current frame span */
    if (startOfScaledTransformedRange && !endOfScaledTransformedRange) {
      width = endFrameOfCurrentFrameRange - startOfScaledTransformedRange;
      left = Math.max(startOfScaledTransformedRange - 1, 0);
      return {
        width: (width + 1) * $timelineCellWidth,
        left: left * $timelineCellWidth,
        showBorderLeft: true,
        showBorderRight: false,
        borderRadiusLeft: 6,
        borderRadiusRight: 0,
        debug: 1,
      };
    }

    /** Have end frame in current frame span, but no start frame in current frame span */
    if (!startOfScaledTransformedRange && endOfScaledTransformedRange) {
      width = endOfScaledTransformedRange - startFrameOfCurrentFrameRange;
      left = 0;
      return {
        width: (width + 1) * $timelineCellWidth,
        left: left * $timelineCellWidth,
        showBorderLeft: false,
        showBorderRight: true,
        borderRadiusLeft: 0,
        borderRadiusRight: 6,
        debug: 2,
      };
    }

    /** Have both start and end frame in current frame span */
    if (startOfScaledTransformedRange && endOfScaledTransformedRange) {
      width = endOfScaledTransformedRange - startOfScaledTransformedRange;
      left = Math.max(
        startOfScaledTransformedRange - startFrameOfCurrentFrameRange,
        0,
      );
      return {
        width: (width + 1) * $timelineCellWidth,
        left: left * $timelineCellWidth,
        showBorderLeft: true,
        showBorderRight: true,
        borderRadiusLeft: 6,
        borderRadiusRight: 6,
        debug: 3,
      };
    }

    return {
      width,
      left,
      showBorderLeft,
      showBorderRight,
      borderRadiusLeft,
      borderRadiusRight,
      debug: 4,
    };
  });

  // Variables::Selected and Hovered
  let isSelected = $derived.by<boolean>(() => {
    const selectedAnnotationId = $selectedAnnotation?.metadata.id;
    const selectedAnnotationGroupId =
      $selectedAnnotation?.metadata?.metadata?.group_id;
    let selectedAnnotationIsInThisAnnotationGroup: boolean;

    /** Check if selected annotation is in this annotation group or not*/
    if (selectedAnnotationId === groupId) {
      selectedAnnotationIsInThisAnnotationGroup = true;
    } else if (selectedAnnotationGroupId === groupId) {
      selectedAnnotationIsInThisAnnotationGroup = true;
    } else {
      selectedAnnotationIsInThisAnnotationGroup = false;
    }

    /** If selected annotation is not in this annotation group, isSelected = false */
    if (!selectedAnnotationIsInThisAnnotationGroup) return false;

    /** Check if selected annotation is in this frame range */
    const startFrameOfSelectedAnnotation = $selectedAnnotation?.shape.start;
    const endFrameOfSelectedAnnotation = $selectedAnnotation?.shape.end;
    let selectedAnnotationIsInThisFrameRange: boolean;

    if (startFrameOfSelectedAnnotation === startFrameOfGroup) {
      selectedAnnotationIsInThisFrameRange = true;
    } else if (endFrameOfSelectedAnnotation === endFrameOfGroup) {
      selectedAnnotationIsInThisFrameRange = true;
    } else {
      selectedAnnotationIsInThisFrameRange = false;
    }

    return selectedAnnotationIsInThisFrameRange;
  });
  let isHovered = $state(false);
  let isSelectedOrHovered = $derived(isSelected || isHovered);

  // Variables::Group Category
  let groupCategory = $derived(getGroupCategory(annotationGroup));
  let groupColor = $derived(groupCategory.color);
  let groupTextColor = $derived(groupCategory.text_color);

  // Functions
  function getGroupCategory(
    annGroup: AnnotationGroup<VideoAnnotationObject>,
  ): IConfigValue {
    const { annotations } = annGroup;
    const fallbackGroupCategory = {
      id: "",
      label: "",
      value: "",
      color: "gray",
      text_color: "black",
    };

    const firstAnnotationInGroup = annotations[0];
    const firstAnnotationCategory = firstAnnotationInGroup.value.category;
    if (!firstAnnotationCategory) return fallbackGroupCategory;

    const foundCategory = findCategory({
      labelConfig: context.config,
      categoryId: firstAnnotationCategory,
      shapeType: firstAnnotationInGroup.shape.type,
    });

    return foundCategory ?? fallbackGroupCategory;
  }
</script>

<!-- NOTE::
  - This component is for rendering annotations / interpolation only
  - If you need to add more interactive features like onclick, oncontextmenu, etc.
  - Add it to TimelineRowGroup.svelte component instead.
  - As clicking on row group will have all context (annotationGroup, clientX, frame, etc.)
-->

<!-- ANNOTATION GROUP -->
{#if scaledTransformedRangeStyle.width}
  {@const showBorder = isSelected}
  <div
    id="timeline-annotation-cell__scaled"
    role="cell"
    tabindex="-1"
    class="hover:bg-primary/30 absolute -translate-y-[50%]"
    style:border-color={groupColor}
    style:border-top="{showBorder ? 1 : 0}px solid {groupColor}"
    style:border-bottom="{showBorder ? 1 : 0}px solid {groupColor}"
    style:border-left={scaledTransformedRangeStyle.showBorderLeft
      ? `${showBorder ? 1 : 0}px solid ${groupColor}`
      : "none"}
    style:border-right={scaledTransformedRangeStyle.showBorderRight
      ? `${showBorder ? 1 : 0}px solid ${groupColor}`
      : "none"}
    style:border-top-left-radius="{scaledTransformedRangeStyle.borderRadiusLeft}px"
    style:border-bottom-left-radius="{scaledTransformedRangeStyle.borderRadiusLeft}px"
    style:border-top-right-radius="{scaledTransformedRangeStyle.borderRadiusRight}px"
    style:border-bottom-right-radius="{scaledTransformedRangeStyle.borderRadiusRight}px"
    style:background-color="{groupColor}{isSelectedOrHovered ? 60 : 30}"
    style:color={groupTextColor}
    style:width="{scaledTransformedRangeStyle.width}px"
    style:height="{annotationHeight}px"
    style:left="{scaledTransformedRangeStyle.left}px"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  ></div>

  <!-- ANNOTATION AT FRAME (INTERPOLATION) -->
  {#each notNullScaledTransformedFrameRanges as interpolationAtFrame, interpolationAtFrameIndex (interpolationAtFrameIndex)}
    <div
      class="absolute translate-x-[15%] -translate-y-[50%] rounded-sm text-white"
      style:background-color={groupColor}
      style:height="{annotationHeight * 0.6}px"
      style:width="{$timelineCellWidth * 0.8}px"
      style:left="{Math.max(
        interpolationAtFrame - startFrameIndexOfCurrentFrameRange - 1,
        0,
      ) * $timelineCellWidth}px"
    ></div>
  {/each}
{/if}
