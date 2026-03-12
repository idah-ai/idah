<script lang="ts">
  import type { Snippet } from "svelte";

  import type { AnnotationGroup } from "@/context/AnnotationContext";
  import type { AnnotationObject } from "../data/annotations";

  import { cn } from "@/utils";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<AnnotationObject>;
    timelineCellWidth: number;
    children: Snippet;
    class?: string | null;
  }
  let { annotationGroup, timelineCellWidth, children, class: className }: Props = $props();

  // Functions
  function onCellClick(e: MouseEvent) {
    const timelineRowHeaderWidth = 320;

    /** Compute frame base on timelineRulerWidth, e.clientX, windowWidth */
    const frame = Math.ceil((e.clientX - timelineRowHeaderWidth) / timelineCellWidth);
    console.log(`Click on frame: ${frame}, groupId: ${annotationGroup.groupId}`);
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
