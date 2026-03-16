<script lang="ts">
  import type { Snippet } from "svelte";

  import type { AnnotationGroup } from "@/context/AnnotationContext";
  import type { AnnotationObject } from "../data/annotations";

  import { cn } from "@/utils";

  import { selectedAnnotationGroup } from "../../../plugins/idah-video/video-annotation-activity/store";
  import { getFrameFromMouseX } from "./utils";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<AnnotationObject>;
    timelineCellWidth: number;
    onSelectFrameX: (frameX: number) => void;
    onContextMenu: (e: MouseEvent) => void;

    children: Snippet;
    class?: string | null;
  }
  let {
    annotationGroup,
    timelineCellWidth,
    onSelectFrameX,
    onContextMenu,
    children,
    class: className,
  }: Props = $props();

  // Variables
  let { groupId, annotations } = $derived(annotationGroup);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId == groupId);

  // Functions
  // TODO:: Refactor this in to utils folder or common folder as this function uses in this component and video-annotation-activity.svelte#selectClosestAnnotation()
  function findClosestAnnotation(frame: number) {
    let closestAnnotation = annotationGroup.annotations[0];

    if (annotations.length <= 1) return annotations[0];

    let minDiff = Infinity;

    for (const annotation of annotations) {
      const start = annotation.shape.start;
      const end = annotation.shape.end;

      // If frame is within an annotation, that's the one
      if (frame >= start && frame <= end) {
        closestAnnotation = annotation;
        minDiff = 0;
        break;
      }

      // Calculate distance to nearest edge
      const diff = Math.min(Math.abs(frame - start), Math.abs(frame - end));

      if (diff < minDiff) {
        minDiff = diff;
        closestAnnotation = annotation;
      }
    }

    return closestAnnotation;
  }

  function onCellClick(e: MouseEvent) {
    const timelineRowHeaderWidth = 320;

    /** Compute frame base on timelineRulerWidth, e.clientX, windowWidth */
    const frame = getFrameFromMouseX({ clientX: e.clientX, timelineRowHeaderWidth, timelineCellWidth });

    if (frame > 0) {
      /** Click on annotation row which have a frame */
      // TODO: Handle click on annotation at specific cell

      /** Select annotation ? */
      const closestAnnotation = findClosestAnnotation(frame);
      console.log(
        `You're selecting on frame ${frame} in group ${groupId} with closest annotation ${closestAnnotation?.metadata.id}`,
      );
    } else {
      /** Click on annotation group header */
      // TODO: Handle click on annotation group header
      console.log(`You're selecting on group ${groupId}`);
    }

    /** Select an annotation group */
    $selectedAnnotationGroup = annotationGroup;

    onSelectFrameX(e.clientX);
  }
</script>

<div
  id="timeline-row-group"
  role="button"
  tabindex="-1"
  class={cn(
    "relative flex w-full items-center font-light",
    {
      "bg-primary/10 font-medium": isGroupSelected,
    },
    className,
  )}
  onclick={onCellClick}
  oncontextmenu={onContextMenu}
  onkeypress={() => {}}
>
  {@render children()}
</div>
