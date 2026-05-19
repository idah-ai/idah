<script lang="ts">
  import { ArrowLeftToLineIcon, ArrowRightToLineIcon } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Separator from "$lib/components/ui/Separator/Separator.svelte";

  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";

  import type { ContextMenuComponentProps } from "$lib/components/App/ContextMenu/store";
  import type { TrackData, TimelineItem } from "$lib/components/App/Timeline/types";

  // Props — either `track` (title right-click) or `trackId`/`frame`/`items` (empty area right-click)
  interface Props extends ContextMenuComponentProps {
    track?: TrackData;
    trackId?: string;
    frame?: number;
    items?: TimelineItem[];
  }
  let { track, trackId, frame, items }: Props = $props();

  // ── Track title context menus (existing) ──────────────────────────────
  let groupMenus = $derived(track ? getGroupContextMenus({ track }) : null);
  let annotationIsLocked = $derived(trackId ? annotation.isLocked(trackId) : false);

  // ── Empty-area extend menus (new) ─────────────────────────────────────
  let prevAnnotation = $derived.by<TimelineItem | undefined>(() => {
    if (!items || frame === undefined) return undefined;
    // Find the annotation that ends closest before the clicked frame
    let best: TimelineItem | undefined;
    for (const item of items) {
      if (item.endRange < frame) {
        if (!best || item.endRange > best.endRange) best = item;
      }
    }
    return best;
  });

  let nextAnnotation = $derived.by<TimelineItem | undefined>(() => {
    if (!items || frame === undefined) return undefined;
    // Find the annotation that starts closest after the clicked frame
    let best: TimelineItem | undefined;
    for (const item of items) {
      if (item.startRange > frame) {
        if (!best || item.startRange < best.startRange) best = item;
      }
    }
    return best;
  });
</script>

<div class="bg-background my-1 flex flex-col">
  {#if groupMenus}
    <!-- Track title context menu -->
    {#each Object.entries(groupMenus) as [groupKey, group], groupIndex (groupKey)}
      {@const isLastGroup = Object.keys(groupMenus).length - 1 === groupIndex}

      {#each Object.entries(group.items) as [menuKey, { label, icon: Icon, disabled, hidden, destructive, onClick }] (menuKey)}
        {#if !hidden}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div role="none" onclick={(e) => { if (disabled) e.stopPropagation(); }}>
            <Button
              variant={destructive ? "destructive-ghost" : "ghost"}
              size="sm"
              class="mx-1 w-full justify-start"
              {disabled}
              onclick={onClick}
            >
              <Icon />
              {label}
            </Button>
          </div>
        {/if}
      {/each}

      {#if !isLastGroup && Object.keys(group.items).length > 0}
        <Separator class="my-1" />
      {/if}
    {/each}
  {:else if trackId && frame !== undefined}
    <!-- Empty track area context menu — extend actions -->
    {#if prevAnnotation}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div role="none" onclick={(e) => { if (annotationIsLocked) e.stopPropagation(); }}>
        <Button
          variant="ghost"
          size="sm"
          class="mx-1 w-full justify-start"
          disabled={annotationIsLocked}
          onclick={() => {
            getDriver().command.call("annotation.extend_prev", {
              annotationId: prevAnnotation.rawData.id,
              frame,
            });
          }}
        >
          <ArrowRightToLineIcon />
          Extend previous annotation to frame {frame + 1}
        </Button>
      </div>
    {/if}

    {#if nextAnnotation}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div role="none" onclick={(e) => { if (annotationIsLocked) e.stopPropagation(); }}>
        <Button
          variant="ghost"
          size="sm"
          class="mx-1 w-full justify-start"
          disabled={annotationIsLocked}
          onclick={() => {
            getDriver().command.call("annotation.extend_next", {
              annotationId: nextAnnotation.rawData.id,
              frame,
            });
          }}
        >
          <ArrowLeftToLineIcon />
          Extend next annotation to frame {frame + 1}
        </Button>
      </div>
    {/if}

    {#if !prevAnnotation && !nextAnnotation}
      <div class="text-muted-foreground px-4 py-2 text-xs">No annotations to extend</div>
    {/if}
  {/if}
</div>
