<script lang="ts" generics="T extends Record">
  import { FunnelXIcon, InboxIcon, SearchXIcon } from "@lucide/svelte";
  import { getContext, type Snippet } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { TableCell, TableRow } from "@/components/ui/table";

  import { getTableState } from "@/components/app/datasource-table/datasource-table.stores.svelte";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";
  import type { Record } from "@/data/model/Record";
  import { refetches, type RefetchesKey } from "@/utils/refetch";

  // Props
  interface Props {
    isFiltering: boolean;
  }
  let { isFiltering }: Props = $props();

  // Contexts
  const datasourceTableId: string = getContext("id");
  const columns: ColumnsSettings<T> = getContext("columns");
  const dataTableName: string = getContext("dataTableName");
  const refetchKey: RefetchesKey = getContext("refetchKey");
  const addNewRecordButton: Snippet | undefined = getContext("addNewRecordButton");
  const emptyState: Snippet | undefined = getContext("emptyState");
  const filteredState: Snippet | undefined = getContext("filteredState");

  // Functions
  function clearFilters() {
    const tableState = getTableState(datasourceTableId);
    tableState.tablePreferences.update((prefs) => ({
      ...prefs,
      filters: {},
    }));

    $refetches[refetchKey].list = new Date();
  }
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={Object.keys(columns).length}>
    {#if isFiltering}
      {#if filteredState}
        {@render filteredState()}
      {:else}
        <ResponseBlock
          title="No {dataTableName} found"
          description="Try adjusting your filters to find what you're looking for or add a new {dataTableName}."
          icon={SearchXIcon}
        >
          {#snippet actions()}
            <Button variant="outline" onclick={clearFilters}>
              <FunnelXIcon class="size-4"></FunnelXIcon>
              Clear filters
            </Button>

            {#if addNewRecordButton}
              {@render addNewRecordButton()}
            {/if}
          {/snippet}
        </ResponseBlock>
      {/if}
    {:else if emptyState}
      {@render emptyState()}
    {:else}
      <ResponseBlock
        title="No {dataTableName}"
        description="Please add a {dataTableName} to get started"
        icon={InboxIcon}
      >
        {#snippet actions()}
          {#if addNewRecordButton}
            {@render addNewRecordButton()}
          {/if}
        {/snippet}
      </ResponseBlock>
    {/if}
  </TableCell>
</TableRow>
