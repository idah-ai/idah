<script lang="ts">
  import TrackBlockContextMenu from "$lib/components/App/Timeline/annotations/_TrackBlockContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";
  import { getDriver } from "$lib/state/driver.svelte";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";

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
      labelConfig: getDriver().config,
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
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    <!-- Width of keyframe need to less than rangeSize to show padding -->
    {@const width = (100 / rangeSize) * 0.9}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] rounded-sm focus:outline-none"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={category ? category.color : DEFAULT_BG_COLOR}
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}
</button>
