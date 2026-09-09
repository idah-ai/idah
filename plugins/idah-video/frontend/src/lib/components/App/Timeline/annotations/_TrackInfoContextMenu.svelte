<script lang="ts">
  import { ArrowLeftToLineIcon, ArrowRightToLineIcon } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Separator from "$lib/components/ui/Separator/Separator.svelte";

  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { isEditable } from "$lib/state/editor.svelte";

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
  let annotationIsLocked = $derived(trackId && items ? items.some((item) => annotation.isLocked(item.rawData)) : false);
  let disabled = $derived(annotationIsLocked || !isEditable());

  // ── Extend All buttons: disabled if ANY selected annotation/group is locked ──
  let extendAllDisabled = $derived.by(() => {
    if (!isEditable()) return true;
    const all = data.annotations?.items ?? [];
    const selectedIds = new Set(selection.selectedAnnotationIds);
    const selectedGids = new Set(selection.selectedGroupIds);
    for (const ann of all) {
      const gid = (ann.metadata as any)?.group_id ?? ann.id;
      if (selectedIds.has(ann.id) || selectedGids.has(gid)) {
        if (annotation.isLocked(ann) || annotation.isLocked(gid)) return true;
      }
    }
    return false;
  });

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

  // Whether multiple annotations / groups are selected — drives showing the
  // "Extend All" actions instead of the per-track single extend actions.
  let isMultiSelection = $derived(selection.selectedAnnotationIds.size > 1 || selection.selectedGroupIds.size > 1);

  // Annotations belonging to the clicked group (trackId) — used to decide
  // which "Extend All" action is relevant.
  let clickedGroupAnnotations = $derived.by(() => {
    if (!trackId) return [];
    const all = data.annotations?.items ?? [];
    return all.filter((a) => ((a.metadata as any)?.group_id ?? a.id) === trackId);
  });

  let extendFrame = $derived(frame ?? viewport.video.currentFrame.value);

  // Determine the clicked group's frame range:
  let clickedGroupFirstStart = $derived.by((): number => {
    let best = Infinity;
    for (const ann of clickedGroupAnnotations) {
      const frames = (ann.shape as any)?.frames as any[] | undefined;
      const first = frames && frames.length > 0 ? ((frames[0]?.frame as number) ?? Infinity) : Infinity;
      if (first < best) best = first;
    }
    return best;
  });

  let clickedGroupLastEnd = $derived.by((): number => {
    let best = -1;
    for (const ann of clickedGroupAnnotations) {
      const frames = (ann.shape as any)?.frames as any[] | undefined;
      const last = frames && frames.length > 0 ? ((frames[frames.length - 1]?.frame as number) ?? -1) : -1;
      if (last > best) best = last;
    }
    return best;
  });

  let showExtendAllPrev = $derived(clickedGroupFirstStart < extendFrame);
  let showExtendAllNext = $derived(clickedGroupLastEnd > extendFrame);
</script>

<div class="bg-background my-1 flex flex-col">
  {#if groupMenus}
    <!-- Track title context menu -->
    {#each Object.entries(groupMenus) as [groupKey, group], groupIndex (groupKey)}
      {@const isLastGroup = Object.keys(groupMenus).length - 1 === groupIndex}

      {#each Object.entries(group.items) as [menuKey, { label, icon: Icon, disabled, hidden, destructive, onClick }] (menuKey)}
        {#if !hidden}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            role="none"
            onclick={(e) => {
              if (disabled) e.stopPropagation();
            }}
          >
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
    {#if isMultiSelection}
      {#if showExtendAllPrev}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          role="none"
          onclick={(e) => {
            if (extendAllDisabled) e.stopPropagation();
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            class="mx-1 w-full justify-start"
            disabled={extendAllDisabled}
            onclick={() => {
              getDriver().command.call("idah-video:annotation.extend-prev", { frame });
            }}
          >
            <ArrowRightToLineIcon />
            Extend all previous to frame {frame + 1}
          </Button>
        </div>
      {/if}
      {#if showExtendAllNext}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          role="none"
          onclick={(e) => {
            if (extendAllDisabled) e.stopPropagation();
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            class="mx-1 w-full justify-start"
            disabled={extendAllDisabled}
            onclick={() => {
              getDriver().command.call("idah-video:annotation.extend-next", { frame });
            }}
          >
            <ArrowLeftToLineIcon />
            Extend all next to frame {frame + 1}
          </Button>
        </div>
      {/if}
      {#if !showExtendAllPrev && !showExtendAllNext}
        <div class="text-muted-foreground px-4 py-2 text-xs">No annotations to extend</div>
      {/if}
    {:else}
      <!-- Single-track extend actions -->
      {#if prevAnnotation}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          role="none"
          onclick={(e) => {
            if (disabled) e.stopPropagation();
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            class="mx-1 w-full justify-start"
            {disabled}
            onclick={() => {
              getDriver().command.call("idah-video:annotation.extend-prev", {
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
        <div
          role="none"
          onclick={(e) => {
            if (disabled) e.stopPropagation();
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            class="mx-1 w-full justify-start"
            {disabled}
            onclick={() => {
              getDriver().command.call("idah-video:annotation.extend-next", {
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
  {/if}
</div>
