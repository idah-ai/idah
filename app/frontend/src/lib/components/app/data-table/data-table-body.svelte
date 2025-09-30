<script lang="ts" generics="T extends Record">
  import Copyable from "@/components/app/texts/copyable.svelte";
  import DataTableEmpty from "@/components/app/data-table/data-table-empty.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import TableBody from "@/components/ui/table/table-body.svelte";
  import TableCell from "@/components/ui/table/table-cell.svelte";
  import TableRow from "@/components/ui/table/table-row.svelte";

  import { cn } from "@/utils";

  import { Record } from "@/data/model/Record";
  import type { ColumnsSettings, TableData } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props<T extends Record> {
    tableData: TableData<T>;
    columns: ColumnsSettings<T>;
  }
  let { tableData, columns }: Props<T> = $props();
</script>

<TableBody>
  {#each tableData.response.data as record}
    <TableRow>
      {#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
        {@const { dataType, clickable, cellComponent: CellComponent, visible } = columnSetting}
        {@const value = record[columnKey] || ""}

        {#if visible}
          <TableCell
            class={cn("px-5 py-4", {
              "cursor-pointer": clickable,
            })}
          >
            {#if CellComponent}
              <CellComponent {record} contexts={tableData.contexts} />
            {:else if dataType === "string"}
              {value}
            {:else if dataType === "number"}
              {Number(value)}
            {:else if dataType === "email"}
              {#if value}
                <Copyable title="email" value={value as string} />
              {:else}
                -
              {/if}
            {:else if dataType === "date"}
              <DateText size="sm" showTooltip datetime={value as Date} datetimeFormat="MMM dd, yyyy" />
            {:else if dataType === "datetime"}
              <DateText size="sm" showTooltip datetime={value as Date} datetimeFormat="MMM dd, yyyy HH:mm:ss" />
            {:else if dataType === "time"}
              <DateText size="sm" showTooltip datetime={value as Date} datetimeFormat="HH:mm:ss" />
            {:else if dataType === "enum"}
              {value}
            {/if}
          </TableCell>
        {/if}
      {/each}
    </TableRow>
  {:else}
    <DataTableEmpty />
  {/each}
</TableBody>
