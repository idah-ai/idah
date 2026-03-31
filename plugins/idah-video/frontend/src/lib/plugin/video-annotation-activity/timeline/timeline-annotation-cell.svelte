<script lang="ts">
  import { getContext } from "svelte";

  import { selectedAnnotation } from "$lib/plugin/video-annotation-activity/store/store";
  import { framePerScale, timelineCellWidth } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";

  import type { IActivityContext, IConfigValue } from "$idah/context/activity-context";
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
  const annotationHeight = 24;

  let rangeLength = $derived(frameRanges.length);
  let startOfRange = $derived(frameRanges[0]);
  let endOfRange = $derived(frameRanges[rangeLength - 1]);

  /**
   * The frame ranges computed with framePerScale
   * E.g. frameRanges = [1, 9, 10] / [11, 18, 20] and framePerScale = 2
   * scaledFrameRanges should be [1, 4, 5] / [5, 8, 9]
   */
  let scaledFrameRanges = $derived(
    frameRanges.map((frameRange) => Math.max(1, Math.floor(frameRange / $framePerScale))),
  );
  let scaledRangeLength = $derived(scaledFrameRanges.length);
  let startOfScaledRange = $derived(scaledFrameRanges[0]);
  let endOfScaledRange = $derived(scaledFrameRanges[scaledRangeLength - 1]);
  let scaledRangeWidth = $derived((endOfScaledRange - (startOfScaledRange - 1)) * $timelineCellWidth);

  let isSelected = $derived(
    $selectedAnnotation?.shape.start === startOfRange && $selectedAnnotation?.shape.end === endOfRange,
  );
  let isHovered = $state(false);
  let isSelectedOrHovered = $derived(isSelected || isHovered);

  let groupCategory = $derived(getGroupCategory(annotationGroup));
  let groupColor = $derived(groupCategory.color);
  let groupTextColor = $derived(groupCategory.text_color);

  // Functions
  function getGroupCategory(annGroup: AnnotationGroup<VideoAnnotationObject>): IConfigValue {
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
<div
  id="timeline-annotation-cell__scaled"
  role="cell"
  tabindex="-1"
  class="hover:bg-primary/30 absolute -translate-y-[50%] rounded-sm border"
  style:border-color={groupColor}
  style:background-color="{groupColor}{isSelectedOrHovered ? 60 : 30}"
  style:color={groupTextColor}
  style:width="{scaledRangeWidth}px"
  style:height="{annotationHeight}px"
  style:left="{Math.abs(startOfScaledRange - 1) * $timelineCellWidth}px"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
></div>

<!-- ANNOTATION AT FRAME (INTERPOLATION) -->
{#each scaledFrameRanges as interpolationAtFrame, interpolationAtFrameIndex (interpolationAtFrameIndex)}
  <div
    class="absolute translate-x-[15%] -translate-y-[50%] rounded-sm"
    style:background-color={groupColor}
    style:height="{annotationHeight * 0.6}px"
    style:width="{$timelineCellWidth * 0.8}px"
    style:left="{(interpolationAtFrame - 1) * $timelineCellWidth}px"
  ></div>
{/each}
