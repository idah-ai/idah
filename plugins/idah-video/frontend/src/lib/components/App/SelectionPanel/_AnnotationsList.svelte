<script lang="ts">
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";

  import AnnotationsErrorAlertIcon from "$lib/components/App/SelectionPanel/_AnnotationsErrorAlertIcon.svelte";
  import AnnotationsListItem from "$lib/components/App/SelectionPanel/_AnnotationsListItem.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
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
  import Text from "$lib/components/ui/Text/Text.svelte";
  import { categorySearch } from "$lib/state/category-search.svelte";

  import type { IVideoAnnotationRecord } from "$lib/types";

  type Props = {
    annotations: IVideoAnnotationRecord[];
    currentFrame: number;
  };

  let { annotations, currentFrame }: Props = $props();

  const PAGE_SIZE = 10;
  let page = $state(1);

  // Latest created first (descending by created_at). Newly-created annotations
  // don't have a created_at yet (the server assigns it), so treat a missing
  // value as "just now" so they sort to the top immediately. Ties (e.g. several
  // just-created annotations) fall back to insertion order reversed, so the most
  // recently added one comes first.
  const createdAtMs = (ann: IVideoAnnotationRecord) =>
    ann.created_at ? Date.parse(ann.created_at) : Number.POSITIVE_INFINITY;
  const sortedAnnotations = $derived(
    annotations
      // Parse each timestamp once, then compare cheap numbers during the sort.
      .map((ann, i) => ({ ann, i, ts: createdAtMs(ann) }))
      .sort((a, b) => b.ts - a.ts || b.i - a.i)
      .map((entry) => entry.ann),
  );

  // Filter by category search query (case-insensitive).
  // Normalizes hyphens↔spaces so searching by id or label both work.
  const filteredSortedAnnotations = $derived(
    !categorySearch.value
      ? sortedAnnotations
      : sortedAnnotations.filter((ann) =>
          (ann.category ?? "")
            .toLowerCase()
            .replace(/-/g, " ")
            .includes(categorySearch.value.toLowerCase().replace(/-/g, " ")),
        ),
  );

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------
  const totalPages = $derived(Math.max(1, Math.ceil(filteredSortedAnnotations.length / PAGE_SIZE)));
  const pagedAnnotations = $derived(filteredSortedAnnotations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const showPagination = $derived(filteredSortedAnnotations.length > PAGE_SIZE);

  // When paginating, pad the last (shorter) page with empty rows so every page
  // keeps the same height and the pagination controls stay anchored at the bottom.
  const placeholderCount = $derived(showPagination ? PAGE_SIZE - pagedAnnotations.length : 0);

  // Keep the current page within bounds when the list changes.
  $effect(() => {
    if (page > totalPages) page = totalPages;
  });
</script>

<section class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <div class="flex items-center gap-2">
      <Text weight="semibold">Annotations</Text>
      <AnnotationsErrorAlertIcon {annotations} />
    </div>

    <Badge variant="secondary">{annotations.length}</Badge>
    <Text size="sm" class="text-muted-foreground ml-auto">on Frame : {currentFrame + 1}</Text>
  </div>

  <div class="flex flex-col gap-1">
    <Separator class="my-2" />
    {#each pagedAnnotations as annotation (annotation.id)}
      <AnnotationsListItem {annotation} />
    {/each}

    {#if filteredSortedAnnotations.length === 0}
      {#if annotations.length === 0}
        <div class="text-muted-foreground px-2 py-4 text-center text-xs">No annotations on this frame</div>
      {:else}
        <div class="text-muted-foreground px-2 py-4 text-center text-xs">No matching annotations</div>
      {/if}
    {/if}

    <!-- Reserve space on the last page so pagination doesn't shift upward.
         Height matches a real annotation row (icon + actions ≈ 40px). -->
    {#each Array(placeholderCount) as _, i (`placeholder-${i}`)}
      <div class="h-10 shrink-0" aria-hidden="true"></div>
    {/each}
  </div>

  {#if showPagination}
    <Pagination count={filteredSortedAnnotations.length} perPage={PAGE_SIZE} bind:page>
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
