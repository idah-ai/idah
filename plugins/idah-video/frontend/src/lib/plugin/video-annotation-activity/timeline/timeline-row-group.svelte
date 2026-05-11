<script lang="ts">
  import type { Snippet } from "svelte";

  import { currentFrame, selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import { TIMELINE_ROW_HEADER_WIDTH } from "$lib/plugin/video-annotation-activity/timeline/store";
  import { cn } from "$lib/utils";

  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    annotationGroup: AnnotationGroup<VideoAnnotationObject>;
    onSelectFrameX: (frameX: number) => void;
    onContextMenu: (e: MouseEvent) => void;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) => void;

    children: Snippet;
    class?: string | null;
  }
  let {
    annotationGroup,
    onSelectFrameX,
    onContextMenu,
    onSelectAnnotationGroup,
    children,
    class: className,
  }: Props = $props();

  // Variables
  let { groupId } = $derived(annotationGroup);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId == groupId);
  let rowElements: Record<string, HTMLElement> = $state({});

  // Functions
  function onCellClick(e: MouseEvent) {
    const mouseIsClickedOnCells = e.clientX > TIMELINE_ROW_HEADER_WIDTH;

    if (mouseIsClickedOnCells) {
      /** Click on annotation row which have a frame */

      /** Select frame X if click on cells (not group header) */
      onSelectFrameX(e.clientX);
    }

    /** Select annotation group at specific frame at current frame */
    onSelectAnnotationGroup(annotationGroup, $currentFrame);
  }

  function jumpToRowWhenGroupSelected(node: HTMLElement, params: { id: string; isGroupSelected: boolean }) {
    rowElements[params.id] = node;

    return {
      update(newParams: { id: string; isGroupSelected: boolean }) {
        // Scroll into view immediately when this row (group) becomes selected
        if (newParams.isGroupSelected && !params.isGroupSelected) {
          node.scrollIntoView({
            behavior: "instant",
            block: "center",
            inline: "nearest",
          });
        }
        params = newParams;
      },
      destroy() {
        delete rowElements[params.id];
      },
    };
  }
</script>

<div
  id="timeline-row-group"
  role="button"
  tabindex="-1"
  class={cn("relative flex w-full items-center font-light", className, {
    "bg-primary/10 dark:bg-primary/20 border-primary": isGroupSelected,
  })}
  use:jumpToRowWhenGroupSelected={{ id: groupId, isGroupSelected }}
  onclick={onCellClick}
  oncontextmenu={onContextMenu}
  onkeypress={() => {}}
>
  {@render children()}
</div>
