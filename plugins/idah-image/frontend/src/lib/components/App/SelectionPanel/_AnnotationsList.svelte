<script lang="ts">
  import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNextButton,
    PaginationPrevButton,
  } from "$lib/components/ui/Pagination";
  import { Separator } from "$lib/components/ui/Separator";
  import { Tabs, TabsList, TabsTrigger } from "$lib/components/ui/Tabs";
  import Text from "$lib/components/ui/Text/Text.svelte";

  import {
    ChevronLeftIcon,
    ChevronRightIcon,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
    LockOpenIcon,
    Trash2Icon,
  } from "@lucide/svelte";

  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";
  import { getAnnotationActions } from "$lib/components/App/SelectionPanel/menus";
  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { cn } from "$lib/utils";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { isEditable } from "$lib/state/editor.svelte";

  import type { Menus } from "$lib/components/App/ContextMenu/types";
  import type { IImageAnnotationRecord } from "$lib/types";

  type Props = {
    annotations: IImageAnnotationRecord[];
  };

  let { annotations }: Props = $props();

  const PAGE_SIZE = 10;

  // -----------------------------------------------------------------------
  // Tabs: filter the list by annotation state
  // -----------------------------------------------------------------------
  type Tab = "all" | "hidden" | "locked";
  let activeTab = $state<string>("all");
  let page = $state(1);

  // Latest created first (descending by created_at). Newly-created annotations
  // don't have a created_at yet (the server assigns it), so treat a missing
  // value as "just now" so they sort to the top immediately. Ties (e.g. several
  // just-created annotations) fall back to insertion order reversed, so the most
  // recently added one comes first.
  const createdAtMs = (ann: IImageAnnotationRecord) =>
    ann.created_at ? Date.parse(ann.created_at) : Number.POSITIVE_INFINITY;
  const sortedAnnotations = $derived(
    annotations
      // Parse each timestamp once, then compare cheap numbers during the sort.
      .map((ann, i) => ({ ann, i, ts: createdAtMs(ann) }))
      .sort((a, b) => b.ts - a.ts || b.i - a.i)
      .map((entry) => entry.ann),
  );

  const hiddenAnnotations = $derived(sortedAnnotations.filter((ann) => annotation.isHidden(ann)));
  const lockedAnnotations = $derived(sortedAnnotations.filter((ann) => annotation.isLocked(ann)));

  const tabs = $derived<{ id: Tab; label: string; count: number }[]>([
    { id: "all", label: "All", count: sortedAnnotations.length },
    { id: "hidden", label: "Hidden", count: hiddenAnnotations.length },
    { id: "locked", label: "Locked", count: lockedAnnotations.length },
  ]);

  const filteredAnnotations = $derived(
    activeTab === "hidden" ? hiddenAnnotations : activeTab === "locked" ? lockedAnnotations : sortedAnnotations,
  );

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------
  const totalPages = $derived(Math.max(1, Math.ceil(filteredAnnotations.length / PAGE_SIZE)));
  const pagedAnnotations = $derived(filteredAnnotations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const showPagination = $derived(filteredAnnotations.length > PAGE_SIZE);

  // When paginating, pad the last (shorter) page with empty rows so every page
  // keeps the same height and the pagination controls stay anchored at the bottom.
  const placeholderCount = $derived(showPagination ? PAGE_SIZE - pagedAnnotations.length : 0);

  // Keep the current page within bounds when the list or tab changes.
  $effect(() => {
    if (page > totalPages) page = totalPages;
  });

  const isAllHidden = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isHidden(ann)));
  const isAllLocked = $derived(annotations.length > 0 && annotations.every((ann) => annotation.isLocked(ann)));
  const isSomeLocked = $derived(annotations.length > 0 && annotations.some((ann) => annotation.isLocked(ann)));

  const menus = $derived<Menus>({
    actions: {
      items: {
        "visibility-all": {
          label: "Show/Hide All",
          icon: isAllHidden ? EyeOffIcon : EyeIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_visibility_all");
          },
        },
        "editability-all": {
          label: "Lock/Unlock All",
          icon: isAllLocked ? LockIcon : LockOpenIcon,
          onClick: () => {
            getDriver().command.call("annotation.toggle_editability_all");
          },
        },
        "delete-all": {
          label: "Delete all annotations",
          icon: Trash2Icon,
          disabled: !isEditable() || isSomeLocked || viewport.isReviewWorkspace,
          onClick: () => {
            showConfirmDialog({
              title: "Delete all annotations",
              description: "Are you sure you want to delete all annotations?",
              onConfirm: () => getDriver().command.call("annotation.delete_all"),
            });
          },
        },
      },
    },
  });
</script>

<section class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <Text weight="semibold">Annotations</Text>

    <div class="ml-auto flex items-center">
      {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, onClick, disabled }] (key)}
        <CategoryAction {label} icon={Icon} {disabled} onclick={onClick} />
      {/each}
    </div>
  </div>

  <Tabs bind:value={activeTab} onValueChange={() => (page = 1)}>
    <TabsList class="w-full">
      {#each tabs as tab (tab.id)}
        <TabsTrigger value={tab.id} class="text-xs">
          <span class="font-semibold">{tab.count}</span>
          {tab.label}
        </TabsTrigger>
      {/each}
    </TabsList>
  </Tabs>

  <div class="flex flex-col gap-1">
    <Separator class="my-2" />
    {#each pagedAnnotations as ann (ann.id)}
      {@const annShapeType = ann.shape.type as string}
      {@const annConfig = getDriver().config[annShapeType]}
      {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
      {@const annColor = annCategory?.color ?? null}
      {@const annDisplayName = annCategory?.label ?? ann.value?.category ?? "Uncategorized"}
      {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
      <div class="group hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        <button
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          onclick={() => selection.selectAnnotation(ann)}
        >
          <ShapeIcon shapeType={annShapeType} color={annColor} />
          <div class="flex min-w-0 flex-col">
            {#if annParentLabel.length > 0}
              <span class="text-muted-foreground truncate text-xs">{annParentLabel}</span>
            {/if}
            <span class="truncate">{annDisplayName}</span>
          </div>
        </button>

        <div class="ml-auto flex shrink-0 items-center gap-0">
          {#each getAnnotationActions( { items: [ann], annotationId: ann.id }, ) as { label, icon: Icon, disabled, onClick, alwaysShow }, index (index)}
            <CategoryAction
              {label}
              icon={Icon}
              onclick={(e) => {
                if (disabled) return;
                e.stopPropagation();
                onClick(e);
              }}
              class={cn("opacity-0", {
                "opacity-100": alwaysShow,
                "group-hover:opacity-100": !alwaysShow && !disabled,
                "cursor-not-allowed group-hover:opacity-30": disabled,
              })}
            ></CategoryAction>
          {/each}
        </div>
      </div>
    {/each}

    {#if filteredAnnotations.length === 0}
      <div class="text-muted-foreground px-2 py-4 text-center text-xs">
        No {activeTab === "all" ? "" : activeTab} annotations
      </div>
    {/if}

    <!-- Reserve space on the last page so pagination doesn't shift upward.
         Height matches a real annotation row (icon + actions ≈ 40px). -->
    {#each Array(placeholderCount) as _, i (`placeholder-${i}`)}
      <div class="h-10 shrink-0" aria-hidden="true"></div>
    {/each}
  </div>

  {#if showPagination}
    <Pagination count={filteredAnnotations.length} perPage={PAGE_SIZE} bind:page>
      {#snippet children({ pages, currentPage })}
        <PaginationContent class="flex-wrap gap-0.5">
          <PaginationItem>
            <PaginationPrevButton class="size-7 gap-0 px-0 sm:px-0">
              <ChevronLeftIcon class="size-4" />
            </PaginationPrevButton>
          </PaginationItem>
          {#each pages as p (p.key)}
            {#if p.type === "ellipsis"}
              <PaginationItem>
                <PaginationEllipsis class="size-7" />
              </PaginationItem>
            {:else}
              <PaginationItem>
                <PaginationLink
                  page={p}
                  size="icon-sm"
                  class="h-7 w-auto min-w-7 px-1.5 text-xs"
                  isActive={currentPage === p.value}
                >
                  {p.value}
                </PaginationLink>
              </PaginationItem>
            {/if}
          {/each}
          <PaginationItem>
            <PaginationNextButton class="size-7 gap-0 px-0 sm:px-0">
              <ChevronRightIcon class="size-4" />
            </PaginationNextButton>
          </PaginationItem>
        </PaginationContent>
      {/snippet}
    </Pagination>
  {/if}
</section>
