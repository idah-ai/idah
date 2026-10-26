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
  import BulkPropertiesSection from "$lib/components/App/SelectionPanel/_BulkPropertiesSection.svelte";
  import { propertyFullfilled } from "$lib/components/App/SelectionPanel";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { isEditable } from "$lib/state/editor.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";
  import { categoryCounts, prepareBulkCategory, prepareBulkProperties, sharedProperties, type PropertyValue } from "$lib/utils/bulk-category";

  import {  IMAGE_MASK } from "$lib/types";
  import type { IAnnotationRecord } from "$idah/v2/types";
    import type Dice_1 from "@lucide/svelte/icons/dice-1";

  // Optional — when provided, show these items instead of selection.selectedAnnotations.
  // This lets the component be reused for group-selection annotations.
  interface Props {
    items?: IAnnotationRecord[];
    disabled?: boolean;
  }
  let { items, disabled = false }: Props = $props();

  // Source of truth: explicit items prop, or fall back to the selection model.
  let sourceItems = $derived(items ?? selection.selectedAnnotations);

  const PAGE_SIZE = 10;
  let page = $state(1);

  const totalPages = $derived(Math.max(1, Math.ceil(sourceItems.length / PAGE_SIZE)));
  const pagedAnnotations = $derived(sourceItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const showPagination = $derived(sourceItems.length > PAGE_SIZE);
  const placeholderCount = $derived(showPagination ? PAGE_SIZE - pagedAnnotations.length : 0);

  const countLabel = $derived(`${sourceItems.length} selected`);
  let draftCategory = $state<string | undefined>();
  let draftProperties = $state<Record<string, PropertyValue>>({});
  let feedback = $state("");
  const selectionKey = $derived([...selection.selectedAnnotationIds].sort().join("|"));
  const shapeType = $derived(sourceItems[0]?.shape_type);
  const sameShape = $derived(sourceItems.length > 0 && sourceItems.every((item) => item.shape_type === shapeType));
  const counts = $derived(categoryCounts(sourceItems, getDriver().config));
  const fields = $derived(sharedProperties(sourceItems, getDriver()));
  const hasPropertyEdit = $derived(Object.keys(draftProperties).length > 0);
  const currentCategory = $derived(counts.size === 1 ? sourceItems[0]?.category : undefined);
  const configValues = $derived(shapeType ? (getDriver().config[shapeType]?.values ?? []) : []);
  const selectedCategory = $derived(draftCategory ?? currentCategory ?? "");
  const category = $derived(configValues.find((value) => value.id === selectedCategory));
  const preview = $derived.by(() => {
    if (draftCategory && hasPropertyEdit) return undefined;
    if (draftCategory) return prepareBulkCategory(sourceItems, draftCategory, getDriver(), propertyFullfilled);
    if (hasPropertyEdit) return prepareBulkProperties(sourceItems, draftProperties, getDriver(), propertyFullfilled);
    return undefined;
  });
  const blockReason = $derived.by(() => {
    if (!sourceItems.length || sourceItems.length !== selection.selectedAnnotationIds.size) return "Selection is incomplete.";
    if (items) return "Group editing is not available in this step.";
    if (!sameShape) return "Select one shape type to edit. Mixed shape editing comes later.";
    if (shapeType === IMAGE_MASK) return "Image mask bulk editing comes later.";
    if (disabled || !isEditable() || ["completed", "errored"].includes(getDriver().entryStatus)) return "This workspace cannot be edited right now.";
    if (sourceItems.some((item) => annotation.isLocked(item))) return "One or more selected annotations are locked or cannot be edited.";
    if (sourceItems.some((item) => annotation.isHidden(item))) return "One or more selected annotations are hidden. Deselect them before applying.";
    if (draftCategory && hasPropertyEdit) return "Applying category and properties together comes in Scenario 3.";
    if (!draftCategory && !hasPropertyEdit) return "Choose a category or property to apply.";
    if (preview?.error) return preview.error;
    if (draftCategory && sourceItems.every((item) => item.category === draftCategory)) return "All selected annotations already use this category.";
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
    const result = draftCategory
      ? prepareBulkCategory(sourceItems, draftCategory, getDriver(), propertyFullfilled)
      : prepareBulkProperties(sourceItems, draftProperties, getDriver(), propertyFullfilled);
    if (result.error || !result.updates.length) return;
    getDriver().command.call("idah-image:annotation.bulk-update", { updates: result.updates });
    draftCategory = undefined;
    draftProperties = {};
    feedback = "Bulk update queued. Check the workspace sync indicator for save status.";
  }

  function resetProperty(id: string) {
    const next = { ...draftProperties };
    delete next[id];
    draftProperties = next;
    feedback = "";
  }

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });
</script>

<section class="flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <Text weight="semibold">Multiple selection</Text>
    <Badge variant="info" class="ml-auto">{countLabel}</Badge>
  </div>

  <div class="bg-primary/10 flex flex-col gap-2 rounded-lg px-2 py-3 text-xs">
    <strong>Selected Annotations</strong>
    <div class="flex flex-wrap items-center gap-1.5">
      {#each [...counts] as [id, { count, label }] (id)}
        <Badge variant="outline" class="bg-accent">{count} {label}</Badge>
      {/each}
    </div>
  </div>

  <div class="grid gap-4">
	  <CategorySelect
	    {configValues}
	    {category}
	    {selectedCategory}
	    {shapeType}
	    onValueChange={(value) => { draftCategory = value; feedback = ""; }}
	    disabled={disabled || !sameShape || shapeType === IMAGE_MASK}
	    placeholder={counts.size > 1 ? "Mixed — leave unchanged" : "Select category"}
	  />

		<Separator />

	  <BulkPropertiesSection
	    items={sourceItems}
	    {fields}
	    draft={draftProperties}
	    disabled={disabled || Boolean(draftCategory) || !sameShape || shapeType === IMAGE_MASK}
	    onValueChange={(id, value) => { draftProperties = { ...draftProperties, [id]: value }; feedback = ""; }}
	    onReset={resetProperty}
	  />
	  {#if feedback}
	    <p role="status" class="text-muted-foreground text-xs">{feedback}</p>
	  {:else if blockReason}
	    <p role="alert" class="text-muted-foreground text-xs">{blockReason}</p>
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
      {@const annDisplayName = annCategory ? `${annCategory.label}` : (ann.category ?? "Uncategorized")}
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

    {#if sourceItems.length === 0}
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
