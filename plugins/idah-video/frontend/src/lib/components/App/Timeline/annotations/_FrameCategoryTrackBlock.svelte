<script lang="ts">
  import { showContextMenu, type ContextMenuComponent } from "$lib/components/App/ContextMenu/store";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";

  import FrameContextMenu from "$lib/components/App/Timeline/annotations/_FrameContextMenu.svelte";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";
  import type { IVideoAnnotationRecord } from "$lib/types";

  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  let { startRange, endRange, rawData } = $derived(item);
  let category = $derived((rawData as { category?: string }).category ?? "");
  let frameAnnotations = $derived((rawData as { annotations: IVideoAnnotationRecord[] }).annotations ?? []);
  const rangeSize = $derived(Number(endRange - startRange) + 1);

  let frameColors = $derived.by(() =>
    new Map(frameAnnotations.map((a) => [a.id, resolveAnnotationColor(a)])),
  );
  let frameSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "annotation" && (v.annotation as { id?: string })?.id;
  });

  function handleFrameClick(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    const frame = ann.shape.start;
    viewport.video.goToFrame(frame);
    // Select the frame tagging so the right sidebar switches to tagging > frame.
    selection.selectAnnotation(ann as any);
  }

  function handleContextMenu(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu(FrameContextMenu as ContextMenuComponent, { ann }, e.clientX, rect.bottom);
  }
</script>

<div class="relative h-full w-full bg-transparent">
  {#each frameAnnotations as ann (ann.id)}
    {@const frame = ann.shape.start}
    {@const position = ((frame - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    {@const color = frameColors.get(ann.id)}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] cursor-pointer rounded-sm focus:outline-none"
      class:ring-2={frameSelected === ann.id}
      class:ring-offset-1={frameSelected === ann.id}
      style:top="3px"
      style:height="calc(100% - 6px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={color ?? "hsl(var(--primary))"}
      style:--tw-ring-color={frameSelected === ann.id ? (color ?? "hsl(var(--primary))") : "transparent"}
      onclick={(e) => handleFrameClick(e, ann)}
      oncontextmenu={(e) => handleContextMenu(e, ann)}
      onkeypress={() => {}}
    ></div>
  {/each}
</div>