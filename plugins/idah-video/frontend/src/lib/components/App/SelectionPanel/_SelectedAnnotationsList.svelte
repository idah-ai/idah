<script lang="ts">
  import Icon from "$lib/components/ui/Icon";
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

  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { categoryValueToLabel } from "$lib/utils/annotation";

  import { VIDEO_POLYGON } from "$lib/types";

  const PAGE_SIZE = 10;
  let page = $state(1);

  const totalPages = $derived(Math.max(1, Math.ceil(selection.selectedAnnotations.length / PAGE_SIZE)));
  const pagedAnnotations = $derived(selection.selectedAnnotations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const showPagination = $derived(selection.selectedAnnotations.length > PAGE_SIZE);
  const placeholderCount = $derived(showPagination ? PAGE_SIZE - pagedAnnotations.length : 0);

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });
</script>

<section class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <Text weight="semibold">Selected</Text>
    <span class="text-muted-foreground text-xs">{selection.selectedAnnotationIds.size} annotations</span>
  </div>

  <div class="flex flex-col gap-1">
    <Separator class="my-2" />
    {#each pagedAnnotations as ann (ann.id)}
      {@const annShapeType = ann.shape.type as string}
      {@const annConfig = getDriver().config[annShapeType]}
      {@const annCategory = annConfig?.values?.find((v) => v.id === ann.value?.category)}
      {@const annColor = annCategory?.color ?? null}
      {@const annGroupId = ann.metadata?.group_id ?? ann.id}
      {@const annGroupIdLastPart = annGroupId.split("-").pop()}
      {@const annDisplayName = annCategory
        ? `${annCategory.label}-${annGroupIdLastPart}`
        : (ann.value?.category ?? "Uncategorized")}
      {@const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : ""}
      <div class="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs">
        {#if annShapeType === VIDEO_POLYGON}
          <Icon src={polygonIconSvg} color={annColor} />
        {:else}
          <Icon src={vectorSquareIconSvg} color={annColor} />
        {/if}
        <div class="flex min-w-0 flex-col">
          {#if annParentLabel.length > 0}
            <span class="text-muted-foreground truncate text-xs">{annParentLabel}</span>
          {/if}
          <span class="truncate">{annDisplayName}</span>
        </div>
      </div>
    {/each}

    {#if selection.selectedAnnotations.length === 0}
      <div class="text-muted-foreground px-2 py-4 text-center text-xs">No annotations selected</div>
    {/if}

    {#each Array(placeholderCount) as _, i (`placeholder-${i}`)}
      <div class="h-10 shrink-0" aria-hidden="true"></div>
    {/each}
  </div>

  {#if showPagination}
    <Pagination count={selection.selectedAnnotations.length} perPage={PAGE_SIZE} bind:page>
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