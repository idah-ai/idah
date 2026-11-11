<script lang="ts" generics="T extends Record">
  import * as Table from "@/components/ui/table/index";

  import type { DataTableColumnSettings, DataTableRows } from "./types";
  import { cn } from "@/utils";
  import type { Snippet } from "svelte";
  import type { Record } from "@/data/model/Record";

  interface Props {
    columns: DataTableColumnSettings<T>;
    rows: DataTableRows<T>;
    RowComponent?: Snippet;
    caption?: string;
  }
  let { columns, rows, RowComponent, caption }: Props = $props();
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      {#each Object.entries(columns) as [columnKey, column] (columnKey)}
        <Table.Head
          class={cn("text-muted-foreground text-left font-medium", {
            "text-center": column.align === "center",
            "text-right": column.align === "right",
          })}
        >
          {column.title}
        </Table.Head>
      {/each}
    </Table.Row>
  </Table.Header>

  <Table.Body>
    {#each rows as row, rowIndex (rowIndex)}
      {#if RowComponent}
        {@render RowComponent()}
      {:else}
        <Table.Row>
          {#each Object.entries(columns) as [columnKey, column] (columnKey)}
            <Table.Cell
              class={cn("text-left", {
                "text-center": column.align === "center",
                "text-right": column.align === "right",
              })}
            >
              {#if column.cellComponent}
                {@const CellComponent = column.cellComponent}
                <CellComponent {row} />
              {:else}
                {row[column.key]}
              {/if}
            </Table.Cell>
          {/each}
        </Table.Row>
      {/if}
    {/each}
  </Table.Body>

  <div class="flex items-center gap-2">
    {#if caption}
      <Table.Caption class="px-2 text-left">{caption}</Table.Caption>
    {/if}

    <!-- Paginator -->
  </div>
</Table.Root>
