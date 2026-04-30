<script lang="ts">
  import { getContext } from "svelte";

  import TimelineContextMenu from "$lib/plugin/video-annotation-activity/timelines/annotations/_TimelineContextMenu.svelte";

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

    const contextMenuProps: ContextMenuComponentProps = {};

    showContextMenu(TimelineContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }
</script>

<div
  role="button"
  tabindex="0"
  class="box-border h-full w-full overflow-hidden rounded-lg border p-2 focus:outline-none"
  style:background-color="{category ? category.color : DEFAULT_BG_COLOR}70"
  style:border-color={category ? category.color : DEFAULT_BG_COLOR}
  oncontextmenu={handleOnContextMenu}
>
  <!-- KEYFRAMES -->
  {#each keyframes as keyframe (keyframe)}
    {@const padding = 2}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = 100 / rangeSize}
    <div
      class="absolute rounded-sm"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position + padding}%"
      style:width="{width - padding * 2}%"
      style:background-color={category ? category.color : DEFAULT_BG_COLOR}
    ></div>
  {/each}
</div>
