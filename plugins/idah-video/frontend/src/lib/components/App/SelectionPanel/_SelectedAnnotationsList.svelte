<script lang="ts">
  import { Badge } from "$lib/components/ui/Badge";
  import { Button } from "$lib/components/ui/Button";
  import { Separator } from "$lib/components/ui/Separator";
  import Text from "$lib/components/ui/Text/Text.svelte";
  import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNextButton,
    PaginationPrevButton,
  } from "$lib/components/ui/Pagination";
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";
  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import GroupEditMode from "$lib/components/App/SelectionPanel/_GroupEditMode.svelte";
  import BulkPropertiesSection from "$lib/components/App/SelectionPanel/_BulkPropertiesSection.svelte";
  import { propertyFullfilled } from "$lib/components/App/SelectionPanel";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { data, type AnnotationItem } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { truncateMiddle } from "$lib/utils/string";
  import {
    bulkFields,
    bulkPreview,
    categoryCounts,
    prepareBulkCategoryOnly,
    sharedCategories,
    sharedProperties,
    type PropertyValue,
  } from "$lib/utils/bulk-category";
  import { resolveBulkTargets } from "$lib/utils/bulk-targets";

  import type { IAnnotationRecord } from "$idah/v2/types";

  interface Props {
    disabled?: boolean;
  }
  let { disabled = false }: Props = $props();

  const selectionKey = $derived(
    [
      ...[...selection.selectedAnnotationIds].map((id) => `a:${id}`),
      ...[...selection.selectedGroupIds].map((id) => `g:${id}`),
    ]
      .sort()
      .join("|"),
  );
  let groupSnapshot = $state<{ key: string; items: IAnnotationRecord[] } | null>(null);
  let groupLoadError = $state("");

  $effect(() => {
    const key = selectionKey;
    const groupIds = [...selection.selectedGroupIds];
    const store = data.annotations;
    if (!groupIds.length || !store) {
      groupSnapshot = null;
      groupLoadError = "";
      return;
    }

    let active = true;
    groupSnapshot = null;
    groupLoadError = "";
    getDriver()
      .annotations.fetch()
      .then((items) => {
        if (!active) return;
        const allItems = [...items, ...store.items] as IAnnotationRecord[];
        const targets = resolveBulkTargets(selection.selectedAnnotationIds, groupIds, allItems).items;
        const loadedIds = new Set(store.items.map((item) => item.id));
        for (const item of targets) {
          if (!loadedIds.has(item.id)) store.upsert(item as AnnotationItem);
        }
        groupSnapshot = { key, items };
      })
      .catch(() => {
        if (active) groupLoadError = "Could not load all selected group annotations. Reselect the group and try again.";
      });
    return () => {
      active = false;
    };
  });

  const targetResolution = $derived.by(() => {
    const currentItems = (data.annotations?.items ?? []) as IAnnotationRecord[];
    if (selection.selectedGroupIds.size && groupSnapshot?.key !== selectionKey)
      return resolveBulkTargets(selection.selectedAnnotationIds, selection.selectedGroupIds, []);
    const fetchedItems = groupSnapshot?.key === selectionKey ? groupSnapshot.items : [];
    return resolveBulkTargets(selection.selectedAnnotationIds, selection.selectedGroupIds, [
      ...fetchedItems,
      ...currentItems,
    ]);
  });
  let sourceItems = $derived(targetResolution.items);
  const categoryOnly = $derived(selection.selectedGroupIds.size > 0);

  const PAGE_SIZE = 10;
  let page = $state(1);

  const totalPages = $derived(Math.max(1, Math.ceil(sourceItems.length / PAGE_SIZE)));
  const pagedAnnotations = $derived(sourceItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const showPagination = $derived(sourceItems.length > PAGE_SIZE);
  const placeholderCount = $derived(showPagination ? PAGE_SIZE - pagedAnnotations.length : 0);

  const countLabel = $derived(
    selection.selectedGroupIds.size && groupSnapshot?.key !== selectionKey
      ? "Loading selection"
      : `${sourceItems.length} selected`,
  );
  let draftCategory = $state<string | undefined>();
  let draftProperties = $state<Record<string, PropertyValue>>({});
  let feedback = $state("");
  const shapeType = $derived(sourceItems[0]?.shape_type);
  const sameShape = $derived(sourceItems.length > 0 && sourceItems.every((item) => item.shape_type === shapeType));
  const counts = $derived(categoryCounts(sourceItems, getDriver().config));
  const fields = $derived(bulkFields(sourceItems, getDriver(), draftCategory, draftProperties));
  const hasPropertyEdit = $derived(Object.keys(draftProperties).length > 0);
  const currentCategory = $derived(counts.size === 1 ? sourceItems[0]?.category : undefined);
  const configValues = $derived(sharedCategories(sourceItems, getDriver().config));
  const hasSharedChoices = $derived(configValues.length > 0 || (!categoryOnly && fields.length > 0));
  const selectedCategory = $derived(draftCategory ?? currentCategory ?? "");
  const category = $derived(configValues.find((value) => value.id === selectedCategory));
  function getPreview() {
    if (categoryOnly)
      return draftCategory ? prepareBulkCategoryOnly(sourceItems, draftCategory, getDriver()) : undefined;
    return bulkPreview(sourceItems, getDriver(), draftCategory, draftProperties, propertyFullfilled);
  }
  const preview = $derived(getPreview());
  const blockReason = $derived.by(() => {
    if (selection.selectedGroupIds.size && groupSnapshot?.key !== selectionKey)
      return groupLoadError || "Loading all selected group annotations.";
    if (!sourceItems.length || targetResolution.missingAnnotationIds.length || targetResolution.missingGroupIds.length)
      return "Selection is incomplete.";
    if (sourceItems.some((item) => annotation.isLocked(item)))
      return "One or more selected annotations are locked or cannot be edited.";
    if (!sameShape) return "Editing is unavailable because the selected annotations have different shapes.";
    if (!hasSharedChoices) return "No category or property is available for all selected annotations.";
    if (
      disabled ||
      !isEditable() ||
      viewport.isReviewWorkspace ||
      ["completed", "errored"].includes(getDriver().entryStatus)
    )
      return "This workspace cannot be edited right now.";
    if (sourceItems.some((item) => annotation.isHidden(item)))
      return "One or more selected annotations are hidden. Deselect them before applying.";
    if (!draftCategory && (categoryOnly || !hasPropertyEdit))
      return categoryOnly ? "Choose a category to apply." : "Choose a category or property to apply.";
    if (preview?.error) return preview.error;
    if (draftCategory && (categoryOnly || !hasPropertyEdit) && sourceItems.every((item) => item.category === draftCategory))
      return "All selected annotations already use this category.";
    return undefined;
  });

  $effect(() => {
    selectionKey;
    draftCategory = undefined;
    draftProperties = {};
    feedback = "";
  });

  function applyBulk() {
    if (blockReason) return;
    const result = getPreview();
    if (!result || result.error || !result.updates.length) return;
    getDriver().command.call("idah-video:annotation.bulk-update", { updates: result.updates });
    draftCategory = undefined;
    draftProperties = {};
    feedback = "";
  }

  function keepVisibleDrafts(next: Record<string, PropertyValue>, category: string | undefined) {
    const visible = new Set(sharedProperties(sourceItems, getDriver(), category, next).map((field) => field.id));
    const removable = new Set(sharedProperties(sourceItems, getDriver(), category).map((field) => field.id));
    const retained = Object.fromEntries(
      Object.entries(next).filter(([id, value]) => visible.has(id) || (value === undefined && removable.has(id))),
    );
    feedback =
      Object.keys(retained).length < Object.keys(next).length
        ? "Property changes hidden by the current category or values were cleared from the draft."
        : "";
    draftProperties = retained;
  }

  function setDraftCategory(value?: string) {
    draftCategory = value;
    keepVisibleDrafts(draftProperties, value);
  }

  function setDraftProperty(id: string, value: PropertyValue) {
    keepVisibleDrafts({ ...draftProperties, [id]: value }, draftCategory);
  }

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });
</script>

<section class="flex flex-col gap-4">
  {#if categoryOnly}
    <GroupEditMode
      modeTitle="Group selection"
      {shapeType}
      {configValues}
      {category}
      {selectedCategory}
      displayName={countLabel}
      onReSelectCategory={setDraftCategory}
      disabled={disabled || viewport.isReviewWorkspace || !sameShape || configValues.length === 0}
      placeholder={counts.size > 1 ? "Mixed — leave unchanged" : "Select category"}
    />
  {:else}
  <div class="flex items-center gap-2">
    <Text weight="semibold">Multiple selection</Text>
    <Badge variant="info" class="ml-auto">{countLabel}</Badge>
  </div>

  <div class="bg-primary/10 flex flex-col gap-2 rounded-lg px-2 py-3 text-xs">
    <strong>Selected Annotations</strong>
    <div class="flex flex-wrap items-center gap-1.5">
      {#each [...counts] as [id, { count, label }] (id)}
        <Badge variant="outline" class="bg-accent" title={label} aria-label={`${count} ${label}`}>
          {count}
          {truncateMiddle(label)}
        </Badge>
      {/each}
    </div>
  </div>
  {/if}

  <div class="grid gap-4">
    {#if !categoryOnly}
    <CategorySelect
      {configValues}
      {category}
      {selectedCategory}
      {shapeType}
      showShapeIcon={sameShape}
      onValueChange={setDraftCategory}
      disabled={disabled || !sameShape || configValues.length === 0}
      placeholder={counts.size > 1 ? "Mixed — leave unchanged" : "Select category"}
    />

    <Separator />

    <BulkPropertiesSection
      items={sourceItems}
      {fields}
      draft={draftProperties}
      {draftCategory}
      disabled={disabled || viewport.isReviewWorkspace || !sameShape}
      onValueChange={setDraftProperty}
    />
    {/if}
    {#if blockReason}
      {@const isPrompt = blockReason === "Choose a category to apply." || blockReason === "Choose a category or property to apply." || blockReason === "No changes to apply."}
      {#if !(feedback && isPrompt)}
        <p
          role={isPrompt ? "status" : "alert"}
          class={isPrompt
            ? "text-muted-foreground text-xs"
            : "bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs"}
        >
          {blockReason}
        </p>
      {/if}
    {/if}
    {#if feedback}
      <p role="status" class="text-muted-foreground text-xs">{feedback}</p>
    {/if}
  </div>

  <Button size="sm" disabled={Boolean(blockReason)} onclick={applyBulk}>
    Apply to {sourceItems.length}
  </Button>

  <div class="flex flex-col gap-1">
    <Separator class="my-2" />
    {#each pagedAnnotations as ann (ann.id)}
      {@const annShapeType = ann.shape_type as string}
      {@const annConfig = getDriver().config[annShapeType]}
      {@const annCategory = annConfig?.values?.find((v) => v.id === ann.category)}
      {@const annColor = annCategory?.color ?? null}
      {@const annGroupId = ann.metadata?.group_id ?? ann.id}
      {@const annGroupIdLastPart = annGroupId.split("-").pop()}
      {@const annDisplayName = annCategory
        ? `${annCategory.label}-${annGroupIdLastPart}`
        : (ann.category ?? "Uncategorized")}
      {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
      <div class="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        <ShapeIcon shapeType={annShapeType} color={annColor} />
        <div class="flex min-w-0 flex-col">
          {#if annParentLabel.length > 0}
            <span class="text-muted-foreground truncate text-xs">{annParentLabel}</span>
          {/if}
          <span class="truncate">{annDisplayName}</span>
        </div>
      </div>
    {/each}

    {#if sourceItems.length === 0 && !(selection.selectedGroupIds.size && groupSnapshot?.key !== selectionKey)}
      <div class="text-muted-foreground px-2 py-4 text-center text-xs">No annotations selected</div>
    {/if}

    {#each Array(placeholderCount) as _, i (`placeholder-${i}`)}
      <div class="h-10 shrink-0" aria-hidden="true"></div>
    {/each}
  </div>

  {#if showPagination}
    <Pagination count={sourceItems.length} perPage={PAGE_SIZE} bind:page>
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
