<script lang="ts">
  import type { Snippet } from "svelte";

  import type { AnnotationGroup } from "@/context/AnnotationContext";
  import type { AnnotationObject } from "../data/annotations";

  import { cn } from "@/utils";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<AnnotationObject>;
    timelineCellWidth: number;
    onSelectFrameX: (frameX: number) => void;

    children: Snippet;
    class?: string | null;
  }
  let { annotationGroup, timelineCellWidth, onSelectFrameX, children, class: className }: Props = $props();

  // Functions
  function onCellClick(e: MouseEvent) {
    const timelineRowHeaderWidth = 320;

    /** Compute frame base on timelineRulerWidth, e.clientX, windowWidth */
    const frame = Math.ceil((e.clientX - timelineRowHeaderWidth) / timelineCellWidth);

    if (frame > 0) {
      /** Click on annotation row which have a frame */
      // TODO: Handle click on annotation at specific cell
      console.log(`Click on frame: ${frame}, groupId: ${annotationGroup.groupId}`);
    } else {
      /** Click on annotation group header */
      // TODO: Handle click on annotation group header
      console.log(`Click on group header: ${annotationGroup.groupId}`);
    }

    onSelectFrameX(e.clientX);
  }
</script>

<div
  id="timeline-row-group"
  role="button"
  tabindex="0"
  class={cn("relative flex w-full items-center", className)}
  onclick={onCellClick}
  onkeypress={() => {}}
>
  {@render children()}
</div>
