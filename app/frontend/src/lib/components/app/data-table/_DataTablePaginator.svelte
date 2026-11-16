<script lang="ts">
  import * as Pagination from "@/components/ui/pagination/index";
  import type { IDataTablePagination } from "@/components/app/data-table/types.ts";

  import { cn } from "@/utils";

  interface Props extends IDataTablePagination {
    class?: string | null;
  }
  let { count, page = 1, itemsPerPage = 10, hasMore, class: className }: Props = $props();

  const lastPage = $derived(count / itemsPerPage);

  function onPageChange() {}
</script>

<div class={cn("", className)}>
  <Pagination.Root class="justify-end" {count} {page} perPage={itemsPerPage} {onPageChange}>
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        {#if currentPage > 1}
          <Pagination.Item>
            <Pagination.PrevButton />
          </Pagination.Item>
        {/if}

        {#each pages as page, index (index)}
          {#if page.type === "ellipsis"}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value}>
                {#if Math.floor(lastPage) === page.value && hasMore}
                  {page.value}+
                {:else}
                  {page.value}
                {/if}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}

        {#if currentPage < Math.ceil(lastPage)}
          <Pagination.Item>
            <Pagination.NextButton />
          </Pagination.Item>
        {/if}
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
</div>
