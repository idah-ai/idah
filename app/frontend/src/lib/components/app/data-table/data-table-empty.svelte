<script lang="ts" generics="T extends Record">
  import { getContext, type Snippet } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import { TableCell, TableRow } from "@/components/ui/table";

  import { InboxIcon, PlusIcon, SearchXIcon } from "@lucide/svelte";

  import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";
  import type { Record } from "@/data/model/Record";

  // Props
  interface Props {
    isFiltering: boolean;
  }
  let { isFiltering }: Props = $props();

  // Contexts
  const columns: ColumnsSettings<T> = getContext("columns");
  const dataTableName: string = getContext("dataTableName");
  const onNewRecord: (() => Promise<void> | void) | undefined = getContext("onNewRecord");
  const emptyState: Snippet | undefined = getContext("emptyState");
  const filteredState: Snippet | undefined = getContext("filteredState");
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={Object.keys(columns).length}>
    {#if isFiltering}
      {#if filteredState}
        {@render filteredState()}
      {:else}
        <ResponseBlock
          title="No {dataTableName} found"
          description="Try adjusting your filters to find what you're looking for."
          icon={SearchXIcon}
        ></ResponseBlock>
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
          {#if onNewRecord}
            <Button class="capitalize" onclick={onNewRecord}>
              <PlusIcon class="size-4" />
              Add {dataTableName}
            </Button>
          {/if}
        {/snippet}
      </ResponseBlock>
    {/if}
  </TableCell>
</TableRow>
