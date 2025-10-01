<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNextButton,
    PaginationPrevButton,
  } from "@/components/ui/pagination";
  import Text from "@/components/ui/text/Text.svelte";

  import { ChevronsUpDownIcon } from "@lucide/svelte";

  import type { LabelValue } from "@/components/app/component.types";

  // Props
  interface Props {
    page: number;
    itemsPerPage: number;
    count: number;
    hasMore: boolean;
    onPageChange(changeToPage: number): Promise<void>;
    onItemsPerPageSelect(selectedItemsPerPage: number): Promise<void>;
  }
  let { page, onPageChange, count, hasMore, itemsPerPage, onItemsPerPageSelect }: Props = $props();

  // Variables
  const itemsPerPages: LabelValue<number>[] = [
    { label: "10", value: 10 },
    { label: "25", value: 25 },
    { label: "50", value: 50 },
    { label: "100", value: 100 },
  ];

  let openDropdown: boolean = $state(false);
  let lastPage: number = $derived(count / itemsPerPage);
  let selectedItemsPerPage = $derived(
    itemsPerPages.find((item) => item.value === itemsPerPage)?.label ?? itemsPerPages[0].label,
  );
</script>

<div id="data-table-paginator-container" class="grid w-full grid-cols-1 items-center md:grid-cols-2">
  <!-- DATA TABLE::ITEMS PER PAGE -->
  <div id="data-table-paginator-items-per-page" class="flex items-center justify-start gap-2">
    <DropdownMenu bind:open={openDropdown}>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <Button variant="outline" {...props}>
            {selectedItemsPerPage}

            <ChevronsUpDownIcon class="text-muted-foreground size-4" />
          </Button>
        {/snippet}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>Items Per Page</DropdownMenuLabel>

        {#each itemsPerPages as { label, value } (value)}
          <DropdownMenuItem
            onclick={() => {
              openDropdown = false;
              onItemsPerPageSelect(value);
            }}
            disabled={value === itemsPerPage}
          >
            {label}
          </DropdownMenuItem>
        {/each}
      </DropdownMenuContent>
    </DropdownMenu>

    <Text size="sm">Rows per page</Text>
  </div>

  <!-- DATA TABLE::PAGINATION CONTROLS -->
  <div id="data-table-paginator-controls" class="flex items-center justify-end gap-2">
    <Pagination class="justify-end" {count} bind:page perPage={Number(itemsPerPage)}>
      {#snippet children({ pages, currentPage })}
        <PaginationContent>
          <!-- PREVIOUS BUTTON -->
          {#if currentPage > 1}
            <PaginationItem>
              <PaginationPrevButton onclick={() => onPageChange(currentPage - 1)} />
            </PaginationItem>
          {/if}

          {#each pages as page, index (index)}
            {#if page.type === "ellipsis"}
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            {:else}
              <PaginationItem onclick={() => onPageChange(page.value)}>
                <PaginationLink {page} isActive={currentPage === page.value}>
                  {#if Math.floor(lastPage) === page.value && hasMore}
                    {page.value}+
                  {:else}
                    {page.value}
                  {/if}
                </PaginationLink>
              </PaginationItem>
            {/if}
          {/each}

          <!-- NEXT BUTTON -->
          {#if currentPage < Math.ceil(lastPage)}
            <PaginationItem>
              <PaginationNextButton onclick={() => onPageChange(currentPage + 1)} />
            </PaginationItem>
          {/if}
        </PaginationContent>
      {/snippet}
    </Pagination>
  </div>
</div>
