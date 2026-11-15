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
  import { getDriver, syncStatus } from "$lib/state/driver.svelte";
  import { hover } from "$lib/state/hover.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { data, getDeletedAnnotation } from "$lib/state/data.svelte";
  import { media } from "$lib/state/media.svelte";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { groupChangesByDay } from "$lib/utils/history-days";
  import { shapeBounds } from "$lib/utils/shape-bounds";
  import type { IAnnotationChange } from "$idah/v2/types";
  import type { IImageAnnotationShape } from "$lib/types";

  // Scope follows the selection reactively: the store derives the scope from
  // the selection, and this effect reloads (back to page 1) whenever the
  // selected annotation ids change while the panel is open. Reading the
  // selection set directly keeps the effect reactive to it. Initialised to the
  // current signature so the effect's first run (on mount, right after
  // toggle() already loaded) is a no-op.
  let lastScopeSignature = history.scopeSignature;
  $effect(() => {
    // Read the actual ids (not just .size) so switching from one selected
    // annotation to another — same count, different ids — still re-runs.
    Array.from(selection.selectedAnnotationIds).join(",");
    const sig = history.scopeSignature;
    if (!history.open) return;
    if (sig === lastScopeSignature) return;
    lastScopeSignature = sig;
    history.resetPage();
    void history.load();
  });

  // Show this tab's own writes without a manual refresh: reload when the write
  // queue drains while the panel shows the newest page (an older page stays
  // put so the reviewer is not moved while reading).
  let lastQueued = syncStatus.queued;
  $effect(() => {
    const queued = syncStatus.queued;
    const drained = lastQueued > 0 && queued === 0;
    lastQueued = queued;
    if (drained && history.open && history.page === 1) void history.refresh();
  });

  /** 24-hour, like the times on the cards. */
  const UPDATED_TIME_FORMAT: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  /** The live annotation for a change, if any. */
  function liveAnnotation(change: IAnnotationChange) {
    return data.annotations?.items?.find((a) => a.id === change.annotation_id);
  }

  /** Category label for a change's annotation (live, tombstone, or fallback),
   *  with the id's last part so same-category cards can be told apart — the
   *  same `{categoryLabel}-{idLastPart}` naming the video plugin uses. */
  function categoryLabel(change: IAnnotationChange): string {
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const category = ann?.category ?? tomb?.category;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    if (!category) return `Annotation ${change.annotation_id.slice(0, 8)}`;
    const config = shapeType ? getDriver().config[shapeType] : undefined;
    const cat = config?.values?.find((v) => v.id === category);
    const label = cat?.label ?? category;
    return `${label}-${change.annotation_id.split("-").pop()}`;
  }

  /**
   * True when this row's recorded state is soft-deleted: the annotation is
   * deleted now and this row is its latest version (other than its own
   * `deleted` row). That is the `baseline` of an annotation already deleted
   * when change tracking started, or the `created` row of a copied deleted
   * annotation. Older rows from while it was live are not tagged.
   *
   * The latest version is the highest of the cached record's `version` and the
   * loaded rows, so a deletion made in this tab (whose cached record still
   * holds the pre-delete version) is covered once its `deleted` row loads.
   */
  function recordsDeletedState(change: IAnnotationChange): boolean {
    if (change.op === "deleted") return false;
    const ann = liveAnnotation(change);
    const record = ann ? (ann.deleted_at ? ann : undefined) : getDeletedAnnotation(change.annotation_id);
    if (!record) return false;
    const known = (record as { version?: number }).version ?? 0;
    const loaded = history.items.filter((c) => c.annotation_id === change.annotation_id).map((c) => c.version);
    return change.version === Math.max(known, ...loaded);
  }

  /** Category colour for a change's annotation, resolved like the shapes. */
  function categoryColor(change: IAnnotationChange): string {
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const category = ann?.category ?? tomb?.category;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    if (!category || !shapeType) return "#71717a";
    return resolveAnnotationColor({ id: change.annotation_id, category, shape_type: shapeType });
  }

  /** Center the viewport on an annotation's shape (live or tombstone). */
  function centerOnShape(shape: IImageAnnotationShape | undefined, shapeType: string | undefined) {
    const mw = media.width,
      mh = media.height;
    if (mw === 0 || mh === 0) return;
    const b = shapeBounds(shape, shapeType, mw, mh);
    if (!b) return;
    const { minX, minY, maxX, maxY } = b;

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
    // center on the annotation's own shape rather than a frame path.
    const ann = liveAnnotation(change);
    const tomb = getDeletedAnnotation(change.annotation_id);
    const shape = (ann?.shape_args ?? tomb?.shape_args) as IImageAnnotationShape | undefined;
    const shapeType = ann?.shape_type ?? tomb?.shape_type;
    if (ann && !ann.deleted_at) {
      centerOnShape(ann.shape_args as IImageAnnotationShape, ann.shape_type);
      return;
    }
    if (shape) centerOnShape(shape, shapeType);
  }
</script>

<Sidebar variant="inset" collapsible="none" class="h-full w-full">
  <SidebarHeader>
    <div class="flex items-center justify-between gap-2 p-1">
      <span class="text-sm font-semibold">History</span>
      <div class="flex items-center gap-1">
        {#if history.lastLoadedAt}
          <span class="text-muted-foreground text-[10px]"
            >Updated {history.lastLoadedAt.toLocaleTimeString([], UPDATED_TIME_FORMAT)}</span
          >
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
              highlighted={false}
              deleted={recordsDeletedState(change)}
              diff={history.getDiff(change.id)}
              diffLoading={history.isDiffLoading(change.id)}
              open={history.isCardOpen(change.id)}
              onToggle={() => onCardClick(change)}
              onHoverStart={() => hover.setHovered(change.annotation_id)}
              onHoverEnd={() => hover.clearHovered(change.annotation_id)}
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
