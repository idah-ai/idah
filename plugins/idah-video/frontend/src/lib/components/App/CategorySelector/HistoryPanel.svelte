<script lang="ts">
  import {
    ChevronFirstIcon,
    ChevronLastIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CircleXIcon,
    RefreshCwIcon,
  } from "@lucide/svelte";
  import Sidebar from "$lib/components/ui/Sidebar/Sidebar.svelte";
  import SidebarContent from "$lib/components/ui/Sidebar/SidebarContent.svelte";
  import SidebarHeader from "$lib/components/ui/Sidebar/SidebarHeader.svelte";
  import SidebarFooter from "$lib/components/ui/Sidebar/SidebarFooter.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import HistoryChangeCard from "$lib/components/App/CategorySelector/HistoryChangeCard.svelte";
  import { history } from "$lib/state/history.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data, getDeletedAnnotation } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { groupChangesByDay } from "$lib/utils/history-days";
  import type { IAnnotationChange } from "$idah/v2/types";
  import type { IVideoAnnotationShape } from "$lib/types";

  let { sidebarWidthRem }: { sidebarWidthRem: number } = $props();

  // Scope follows the selection reactively: the store derives the scope from
  // the selection, and this effect reloads (back to page 1) whenever the
  // selected annotation or group ids change while the panel is open. Reading
  // the selection sets directly keeps the effect reactive to them. Initialised
  // to the current signature so the effect's first run (on mount, right after
  // toggle() already loaded) is a no-op.
  let lastScopeSignature = history.scopeSignature;
  $effect(() => {
    // Read the actual ids (not just .size) so switching from one selected
    // annotation to another — same count, different ids — still re-runs.
    Array.from(selection.selectedAnnotationIds).join(",");
    Array.from(selection.selectedGroupIds).join(",");
    const sig = history.scopeSignature;
    if (!history.open) return;
    if (sig === lastScopeSignature) return;
    lastScopeSignature = sig;
    history.resetPage();
    void history.load();
  });

  /** The live annotation for a change, if any. */
  function liveAnnotation(change: IAnnotationChange) {
    return data.annotations?.items?.find((a) => a.id === change.annotation_id);
  }

  /** Category label for a change's annotation (live, tombstone, or fallback).
   *  Matches the editor's naming: `{categoryLabel}-{groupIdLastPart}`. */
  function categoryLabel(change: IAnnotationChange): string {
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const category = ann?.category ?? tomb?.category;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    if (!category) return `Annotation ${change.annotation_id.slice(0, 8)}`;
    const config = shapeType ? getDriver().config[shapeType] : undefined;
    const cat = config?.values?.find((v) => v.id === category);
    const label = cat?.label ?? category;
    const groupId = (ann?.metadata?.group_id as string | undefined) ?? ann?.id ?? change.annotation_id;
    const groupIdLastPart = groupId.split("-").pop();
    return `${label}-${groupIdLastPart}`;
  }

  /** Category colour for a change's annotation, resolved like the timeline and
   *  shapes: respects the UI color mode (category vs random) and falls back to
   *  the group's deterministic colour. */
  function categoryColor(change: IAnnotationChange): string {
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const category = ann?.category ?? tomb?.category;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    if (!category || !shapeType) return "#71717a";
    return resolveAnnotationColor({ id: change.annotation_id, category, shape_type: shapeType });
  }

  /** The annotation's frame range, e.g. "frames 12–45" (live or tombstone). */
  function frameRange(change: IAnnotationChange): string | null {
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const shapeArgs =
      (ann?.shape_args as { start?: number; end?: number } | undefined) ??
      (tomb?.shape_args as { start?: number; end?: number } | undefined);
    if (!shapeArgs) return null;
    const start = shapeArgs.start;
    const end = shapeArgs.end;
    if (start === undefined) return null;
    return end !== undefined && end !== start ? `frames ${start}–${end}` : `frame ${start}`;
  }

  /** Center the canvas on an annotation's interpolated shape at a frame. */
  function centerOnShape(shape: IVideoAnnotationShape | undefined, shapeType: string | undefined, frame: number) {
    if (!shape || !shapeType) return;
    const interpolated = getInterpolatedFrame(shape, frame, true, shapeType);
    if (!interpolated || !interpolated.points || interpolated.points.length === 0) return;

    let points = interpolated.points;
    const angle = interpolated.angle ?? 0;
    if (angle !== 0 && points.length >= 3) {
      let cx = 0,
        cy = 0;
      for (const [px, py] of points) {
        cx += px;
        cy += py;
      }
      cx /= points.length;
      cy /= points.length;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      points = points.map(
        ([px, py]) =>
          [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos] as [number, number],
      );
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [px, py] of points) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    const mw = media.width,
      mh = media.height;
    if (mw === 0 || mh === 0) return;
    const sx = minX * mw,
      sy = minY * mh;
    const sw = (maxX - minX) * mw,
      sh = (maxY - minY) * mh;
    const vpW = viewport.workspace.dimensions[0],
      vpH = viewport.workspace.dimensions[1];
    if (vpW === 0 || vpH === 0) return;

    const padding = 0.2;
    const scaleX = vpW / (sw * (1 + padding * 2));
    const scaleY = vpH / (sh * (1 + padding * 2));
    const newScale = Math.min(scaleX, scaleY, 10);
    const centerX = sx + sw / 2,
      centerY = sy + sh / 2;
    viewport.workspace.transform.translate = [vpW / 2 - centerX * newScale, vpH / 2 - centerY * newScale];
    viewport.workspace.transform.scale = newScale;
  }

  function onCardClick(change: IAnnotationChange) {
    history.toggleCard(change.id);
    // The header rows carry no `changes` payload (it is fetched lazily), so
    // seek to the annotation's own start frame rather than a frame path.
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const shape = (ann?.shape_args ?? tomb?.shape_args) as IVideoAnnotationShape | undefined;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    const frame = shape?.start ?? viewport.video.currentFrame.value;
    if (ann && !ann.deleted_at) {
      viewport.video.currentFrame.value = frame;
      centerOnShape(ann.shape_args as IVideoAnnotationShape, ann.shape_type, frame);
      return;
    }
    // Deleted annotation: center on its last known shape (the tombstone).
    if (shapeType && shape) {
      viewport.video.currentFrame.value = frame;
      centerOnShape(shape, shapeType, frame);
    }
  }
</script>

<Sidebar variant="inset" collapsible="none" class="h-full" style="width: {sidebarWidthRem}rem">
  <SidebarHeader>
    <div class="flex items-center justify-between gap-2 p-1">
      <span class="text-sm font-semibold">History</span>
      <div class="flex items-center gap-1">
        {#if history.lastLoadedAt}
          <span class="text-muted-foreground text-[10px]">Updated {history.lastLoadedAt.toLocaleTimeString()}</span>
        {/if}
        <Button variant="ghost" size="icon" title="Refresh" onclick={() => history.refresh()}>
          <RefreshCwIcon class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" title="Close" onclick={() => history.close()}>
          <CircleXIcon class="size-4" />
        </Button>
      </div>
    </div>
    <div class="text-muted-foreground px-1 text-xs">{history.scopeLabel}</div>
  </SidebarHeader>

  <SidebarContent>
    {#if history.loading && history.items.length === 0}
      <div class="text-muted-foreground p-3 text-sm">Loading history…</div>
    {:else if history.error && history.items.length === 0}
      <div class="text-destructive p-3 text-sm">
        <div>History needs a connection.</div>
        <Button variant="outline" size="sm" class="mt-2" onclick={() => history.refresh()}>Retry</Button>
      </div>
    {:else if history.total === 0}
      <div class="text-muted-foreground p-3 text-sm">
        {history.scope.kind === "entry" ? "No changes yet" : "No changes for this selection"}
      </div>
    {:else}
      <div class="pt-1">
        {#each groupChangesByDay(history.items, new Date()) as group (group.label)}
          <div class="text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-medium">{group.label}</div>
          {#each group.items as change (change.id)}
            <HistoryChangeCard
              {change}
              categoryLabel={categoryLabel(change)}
              categoryColor={categoryColor(change)}
              frameRange={frameRange(change)}
              highlighted={false}
              diff={history.getDiff(change.id)}
              diffLoading={history.isDiffLoading(change.id)}
              open={history.isCardOpen(change.id)}
              onToggle={() => onCardClick(change)}
            />
          {/each}
        {/each}
        {#if history.atStartOfHistory}
          <div class="text-muted-foreground px-3 pt-2 pb-2 text-center text-[11px]">Start of history</div>
        {/if}
      </div>
    {/if}
  </SidebarContent>

  {#if history.total > 0}
    <SidebarFooter>
      <div class="flex items-center justify-between gap-1 px-1 text-xs">
        <Button
          variant="ghost"
          size="icon"
          title="Newest"
          disabled={history.page === 1}
          onclick={() => history.goToNewest()}
        >
          <ChevronFirstIcon class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Newer"
          disabled={history.page === 1}
          onclick={() => history.goToPage(history.page - 1)}
        >
          <ChevronLeftIcon class="size-4" />
        </Button>
        <span class="text-muted-foreground">
          {history.pageStart}–{history.pageEnd} of {history.total}{history.hasMore ? "+" : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          title="Older"
          disabled={history.atStartOfHistory}
          onclick={() => history.goToPage(history.page + 1)}
        >
          <ChevronRightIcon class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Oldest"
          disabled={history.atStartOfHistory}
          onclick={() => history.goToOldest()}
        >
          <ChevronLastIcon class="size-4" />
        </Button>
      </div>
    </SidebarFooter>
  {/if}
</Sidebar>
