<script lang="ts">
  import TrackBlockContextMenu from "$lib/components/App/Timeline/annotations/_TrackBlockContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { findCategory } from "$lib/components/App/VideoAnnotationWorkspace/utils/category";
  import { getDriver } from "$lib/state/driver.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { annotationColor } from "$lib/utils/color";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  // Variables
  let { trackId, startRange, endRange, rawData: annotation } = $derived(item);
  const rangeSize = $derived(Number(endRange - startRange) + 1);
  const category = $derived(
    findCategory({
      labelConfig: getDriver().config,
      categoryId: annotation.value?.category,
      shapeType: annotation.shape.type,
    }),
  );
  const keyframes = $derived(annotation.shape.frames.map((f) => f.frame));

  // Compute color using the same annotationColor() as the viewport shapes
  let color = $derived.by(() => {
    return annotationColor(ui.colorMode, annotation, (catId: string) => {
      const config = getDriver().config[annotation?.shape?.type ?? ""];
      return config?.values?.find((v) => v.id === catId)?.color ?? null;
    });
  });

  // Check if this specific annotation is the selected one
  let isSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "annotation" && v.annotation.id === annotation.id;
  });

  // Functions
  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();

    // Compute the frame under the cursor from the mouse position within the block
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const rangeSpan = endRange - startRange + 1;
    const hoverFrame = Math.round(startRange + (relX / rect.width) * rangeSpan);

    const contextMenuProps: ContextMenuComponentProps = {
      item,
      currentFrame: hoverFrame,
    };

    showContextMenu(TrackBlockContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }

  function handleAnnotationClick(e: MouseEvent) {
    e.preventDefault();
    selection.selectAnnotation(annotation);
  }

  function handleKeyframeClick(e: MouseEvent, keyframe: number) {
    e.preventDefault();
    viewport.video.currentFrame.value = keyframe;
  }
</script>

<button
  class="box-border h-full w-full cursor-pointer rounded-lg border p-2 transition-opacity hover:opacity-80 focus:outline-none"
  class:ring-2={isSelected}
  class:ring-offset-1={isSelected}
  style:background-color={color + "30"}
  style:border-color={color}
  style:--tw-ring-color={isSelected ? color : "transparent"}
  onclick={handleAnnotationClick}
  oncontextmenu={handleOnContextMenu}
>
  <!-- KEYFRAMES -->
  {#each keyframes as keyframe (keyframe)}
    {@const position = ((keyframe - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] rounded-sm focus:outline-none"
      style:top="6px"
      style:height="calc(100% - {6 * 2}px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={color}
      onclick={(e) => handleKeyframeClick(e, keyframe)}
      onkeypress={() => {}}
    ></div>
  {/each}
</button>
