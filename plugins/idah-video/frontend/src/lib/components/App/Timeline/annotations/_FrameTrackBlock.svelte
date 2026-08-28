<script lang="ts">
  import { showContextMenu, type ContextMenuComponent } from "$lib/components/App/ContextMenu/store";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";

  import FrameContextMenu from "$lib/components/App/Timeline/annotations/_FrameContextMenu.svelte";
  import EntryRootContextMenu from "$lib/components/App/Timeline/annotations/_EntryRootContextMenu.svelte";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";
  import type { IVideoAnnotationRecord } from "$lib/types";

  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  let { startRange, endRange, rawData } = $derived(item);
  let frameAnnotations = $derived((rawData as { frameAnnotations: IVideoAnnotationRecord[] }).frameAnnotations ?? []);
  let entryRootAnnotation = $derived(
    (rawData as { entryRootAnnotation?: IVideoAnnotationRecord }).entryRootAnnotation,
  );
  const rangeSize = $derived(Number(endRange - startRange) + 1);

  // Resolve category colors the same way shaped annotations do.
  let entryRootColor = $derived.by(() =>
    entryRootAnnotation ? resolveAnnotationColor(entryRootAnnotation) : undefined,
  );
  let frameColors = $derived.by(() =>
    new Map(frameAnnotations.map((a) => [a.id, resolveAnnotationColor(a)])),
  );

  function handleFrameClick(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    const frame = ann.shape.start;
    viewport.video.goToFrame(frame);
    // Select the frame meta so the right sidebar switches to meta > frame.
    selection.selectAnnotation(ann as any);
  }

  function handleEntryRootClick(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    // Select the entry:root annotation so the right sidebar switches to meta > entry.
    selection.selectAnnotation(ann as any);
  }

  function handleContextMenu(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu(FrameContextMenu as ContextMenuComponent, { ann }, e.clientX, rect.bottom);
  }

  function handleEntryRootContextMenu(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showContextMenu(EntryRootContextMenu as ContextMenuComponent, { ann }, e.clientX, rect.bottom);
  }
</script>

<div class="relative h-full w-full bg-transparent">
  {#if entryRootAnnotation}
    {@const rootStart = entryRootAnnotation.shape.start}
    {@const rootEnd = entryRootAnnotation.shape.end}
    {@const rootPos = ((rootStart - startRange) / rangeSize) * 100}
    {@const rootWidth = ((rootEnd - rootStart + 1) / rangeSize) * 100}
    <div
      role="button"
      tabindex="-1"
      class="absolute cursor-pointer rounded-sm border focus:outline-none"
      style:top="3px"
      style:height="calc(100% - 6px)"
      style:left="{rootPos}%"
      style:width="{rootWidth}%"
      style:background-color={entryRootColor ? entryRootColor + "40" : "hsl(var(--primary) / 0.25)"}
      style:border-color={entryRootColor ?? "hsl(var(--primary))"}
      onclick={(e) => handleEntryRootClick(e, entryRootAnnotation)}
      oncontextmenu={(e) => handleEntryRootContextMenu(e, entryRootAnnotation)}
      onkeypress={() => {}}
    ></div>
  {/if}

  {#each frameAnnotations as ann (ann.id)}
    {@const frame = ann.shape.start}
    {@const position = ((frame - startRange) / rangeSize) * 100}
    {@const width = (100 / rangeSize) * 0.9}
    {@const color = frameColors.get(ann.id)}
    <div
      role="button"
      tabindex="-1"
      class="absolute translate-x-[5%] cursor-pointer rounded-sm focus:outline-none"
      style:top="3px"
      style:height="calc(100% - 6px)"
      style:left="{position}%"
      style:width="{width}%"
      style:background-color={color ?? "hsl(var(--primary))"}
      onclick={(e) => handleFrameClick(e, ann)}
      oncontextmenu={(e) => handleContextMenu(e, ann)}
      onkeypress={() => {}}
    ></div>
  {/each}
</div>