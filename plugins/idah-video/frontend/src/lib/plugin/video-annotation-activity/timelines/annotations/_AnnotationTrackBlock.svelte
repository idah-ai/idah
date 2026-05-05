<script lang="ts">
  import { getContext } from "svelte";

  import TrackBlockContextMenu from "$lib/plugin/video-annotation-activity/timelines/annotations/_TrackBlockContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";
  import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { TimelineItem } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Props
  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  // Variables
  let { trackId, startRange, endRange, rawData: annotation } = $derived(item);
  const DEFAULT_BG_COLOR = "#12939"; // bg-gray-800
  const rangeSize = $derived(Number(endRange - startRange) + 1);
  const category = $derived(
    findCategory({
      labelConfig: context.config,
      categoryId: annotation.value.category,
      shapeType: annotation.shape.type,
    }),
  );
  const keyframes = $derived(annotation.shape.frames.map((f) => f.frame));

  // Functions
  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();

    const contextMenuProps: ContextMenuComponentProps = {
      item,
    };

    showContextMenu(TrackBlockContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }

  function handleAnnotationClick(e: MouseEvent) {
    e.preventDefault();
    console.log("TODO:: Select annotation", trackId);
  }

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    e.stopPropagation();
    console.log("TODO:: Select keyframe", keyframe);
  }
</script>

<button
  class="box-border h-full w-full cursor-pointer overflow-hidden rounded-lg border p-2 focus:outline-none"
  style:background-color="{category ? category.color : DEFAULT_BG_COLOR}70"
  style:border-color={category ? category.color : DEFAULT_BG_COLOR}
  onclick={handleAnnotationClick}
  oncontextmenu={handleOnContextMenu}
>
  <!-- KEYFRAMES -->
  {#each keyframes as keyframe (keyframe)}
    {@const padding = 2}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = 100 / rangeSize}
    <div
      role="button"
      tabindex="-1"
      class="absolute rounded-sm focus:outline-none"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position + padding}%"
      style:width="{width - padding * 2}%"
      style:background-color={category ? category.color : DEFAULT_BG_COLOR}
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}
</button>
