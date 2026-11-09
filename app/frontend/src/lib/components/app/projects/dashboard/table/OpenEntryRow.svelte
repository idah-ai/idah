<script lang="ts">
  import { ChevronRightIcon } from "@lucide/svelte";

  import { TableRow, TableCell } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
  import StageDetails from "@/components/app/projects/dashboard/table/OpenEntryStageDetails.svelte";

  import type { OpenEntryColumn } from "@/components/app/projects/dashboard/table/OpenEntry.columns";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let {
    record,
    contexts,
    columns,
    expanded,
    onExpandedChange,
  }: {
    record: EntryRecord;
    contexts: { datasetNames?: { [id: string]: string } };
    columns: OpenEntryColumn[];
    expanded: boolean;
    onExpandedChange: (open: boolean) => void;
  } = $props();
</script>

<Collapsible open={expanded} onOpenChange={onExpandedChange}>
  {#snippet child({ props: rowProps })}
    <TableRow {...rowProps} class={expanded ? "border-b-0" : "last:border-0"}>
      {#each columns as column (column.id)}
        <TableCell class={column.cellClass}>
          {#if column.id === "entry"}
            <div class="flex max-w-80 min-w-0 items-center gap-1">
              <CollapsibleTrigger>
                {#snippet child({ props: triggerProps })}
                  <Button
                    {...triggerProps}
                    variant="ghost"
                    size="icon-sm"
                    class="size-6 shrink-0"
                    aria-label={"Stage details for " + (record.name || record.resource)}
                  >
                    <ChevronRightIcon class={expanded ? "size-3 rotate-90" : "size-3"} />
                  </Button>
                {/snippet}
              </CollapsibleTrigger>
              <column.cell {record} {contexts} />
            </div>
          {:else}
            <column.cell {record} {contexts} />
          {/if}
        </TableCell>
      {/each}
    </TableRow>
    <CollapsibleContent>
      {#snippet child({ props: detailProps })}
        <TableRow {...detailProps}>
          <TableCell colspan={columns.length} class="pb-3 pl-7">
            <StageDetails entryName={record.name || record.resource} />
          </TableCell>
        </TableRow>
      {/snippet}
    </CollapsibleContent>
  {/snippet}
</Collapsible>
