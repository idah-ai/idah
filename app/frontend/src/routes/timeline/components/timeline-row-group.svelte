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
  let { groupId } = $derived(annotationGroup);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId == groupId);

  // Functions
  function onCellClick(e: MouseEvent) {
    const timelineRowHeaderWidth = 320;

    /** Compute frame base on timelineRulerWidth, e.clientX, windowWidth */
    const frame = getFrameFromMouseX({ clientX: e.clientX, timelineRowHeaderWidth, timelineCellWidth });

    if (frame > 0) {
      /** Click on annotation row which have a frame */
      // TODO: Handle click on annotation at specific cell
      console.log(`Click on frame: ${frame}, groupId: ${groupId}`);
    } else {
      /** Click on annotation group header */
      // TODO: Handle click on annotation group header
      console.log(`Click on group header: ${groupId}`);
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
