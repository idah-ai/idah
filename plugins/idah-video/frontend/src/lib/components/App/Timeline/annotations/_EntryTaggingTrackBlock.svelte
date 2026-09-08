<script lang="ts">
  import { showContextMenu, type ContextMenuComponent } from "$lib/components/App/ContextMenu/store";
  import { selection } from "$lib/state/selection.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";

  import EntryRootContextMenu from "$lib/components/App/Timeline/annotations/_EntryRootContextMenu.svelte";

  import type { TimelineItem } from "$lib/components/App/Timeline/types";
  import type { IVideoAnnotationRecord } from "$lib/types";

  interface Props {
    item: TimelineItem;
  }
  let { item }: Props = $props();

  let { startRange, endRange, rawData } = $derived(item);
  let entryRootAnnotation = $derived(
    (rawData as { annotations?: IVideoAnnotationRecord[] }).annotations?.[0],
  );
  const rangeSize = $derived(Number(endRange - startRange) + 1);

  let entryRootColor = $derived.by(() =>
    entryRootAnnotation ? resolveAnnotationColor(entryRootAnnotation) : undefined,
  );
  let entryRootSelected = $derived.by(() =>
    entryRootAnnotation ? selection.isAnnotationSelected(entryRootAnnotation.id) : false,
  );

  function handleEntryRootClick(e: MouseEvent, ann: IVideoAnnotationRecord) {
    e.preventDefault();
    // Select the entry:root annotation so the right sidebar switches to tagging > entry.
    selection.selectAnnotation(ann as any);
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
      class:ring-2={entryRootSelected}
      class:ring-offset-1={entryRootSelected}
      style:top="3px"
      style:height="calc(100% - 6px)"
      style:left="{rootPos}%"
      style:width="{rootWidth}%"
      style:background-color={entryRootColor ? entryRootColor + "40" : "hsl(var(--primary) / 0.25)"}
      style:border-color={entryRootColor ?? "hsl(var(--primary))"}
      style:--tw-ring-color={entryRootSelected ? (entryRootColor ?? "hsl(var(--primary))") : "transparent"}
      onclick={(e) => handleEntryRootClick(e, entryRootAnnotation)}
      oncontextmenu={(e) => handleEntryRootContextMenu(e, entryRootAnnotation)}
      onkeypress={() => {}}
    ></div>
  {/if}
</div>