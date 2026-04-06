<script lang="ts">
  import type { Snippet } from "svelte";

  import {
    selectedAnnotationGroup,
    setSelectedAnnotation,
    setSelectedAnnotationGroup,
  } from "$lib/plugin/video-annotation-activity/store/store";
  import { getFrameFromMouseX } from "$lib/plugin/video-annotation-activity/timeline/utils";
  import { findClosestAnnotationInGroup } from "$lib/plugin/video-annotation-activity/utils/group-annotation.svelte";
  import { cn } from "$lib/utils";

  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
    onSelectFrameX: (frameX: number) => void;
    onContextMenu: (e: MouseEvent) => void;

    children: Snippet;
    class?: string | null;
  }
  let { annotationGroup, onSelectFrameX, onContextMenu, children, class: className }: Props = $props();

  // Variables
  let { groupId } = $derived(annotationGroup);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId == groupId);

  // Functions
  function onCellClick(e: MouseEvent) {
    /** Compute frame base on timelineRulerWidth, e.clientX, windowWidth */
    const frame = getFrameFromMouseX({ clientX: e.clientX });

    if (frame > 0) {
      /** Click on annotation row which have a frame */
      /** Select frame X if click on cells (not group header) */
      onSelectFrameX(e.clientX);

      /** Select closest annotation */
      const closestAnnotation = findClosestAnnotationInGroup({ annotationGroup, frame });
      setSelectedAnnotation(closestAnnotation);
    } else {
      /** Click on annotation group header */
    }

    /** Select an annotation group */
    setSelectedAnnotationGroup(annotationGroup);
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
