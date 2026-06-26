<script lang="ts" generics="T extends Record">
  import { onDestroy, onMount } from "svelte";

  import AppPaginator from "@/components/app/paginators/app-paginator.svelte";
  import { Card, CardContent } from "@/components/ui/card";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import type { DataViewProps } from "@/components/app/data-view/types";
  import type { Record } from "@/data/model/Record";

  let {
    controller,
    ToolbarSlot,
    DataSlot,
    EmptyState,
    LoadingState,
    hidePagination = false,
  }: DataViewProps<T> = $props();

  let unsubRefetch: (() => void) | undefined;

  onMount(async () => {
    await controller.initFromUrl();
    unsubRefetch = controller.subscribeToRefetches();
  });

  onDestroy(() => {
    unsubRefetch?.();
    controller.destroy();
  });
</script>

{#if ToolbarSlot}
  {@render ToolbarSlot()}
{/if}

<!-- DATA LIST -->
<div class="flex flex-col gap-4" class:opacity-60={controller.isFetching}>
  {#each controller.response.data as record (record.id)}
    {@render DataSlot({ record })}
  {:else}
    <Card>
      <CardContent class="min-h-64 flex items-center justify-center">
        {#if controller.isFetching}
          {#if LoadingState}
            {@render LoadingState()}
          {:else}
            <Spinner />
          {/if}
        {:else}
          {@render EmptyState({ isFiltering: controller.isFiltering })}
        {/if}
      </CardContent>
    </Card>
  {/each}
</div>

{#if !hidePagination}
  <AppPaginator
    page={controller.currentPage}
    itemsPerPage={controller.itemsPerPage}
    count={controller.response.meta?.count ?? 0}
    hasMore={controller.response.meta?.more || false}
    onPageChange={(p) => controller.changePage(p)}
    onItemsPerPageSelect={(n) => controller.setItemsPerPage(n)}
  />
{/if}
