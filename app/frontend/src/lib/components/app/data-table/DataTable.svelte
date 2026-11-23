<script lang="ts" generics="T extends Record">
  import * as Table from "@/components/ui/table/index";
  import DataTablePaginator from "@/components/app/data-table/_DataTablePaginator.svelte";

  import type { DataTableColumnSettings, DataTableRows, IDataTablePagination, DataTableListOptions } from "./types";
  import { cn } from "@/utils";
  import type { Snippet } from "svelte";
  import type { Record } from "@/data/model/Record";

  interface Props {
    columns: DataTableColumnSettings<T>;
    rows: DataTableRows<T>;
    RowComponent?: Snippet<[row: T]>;
    caption?: string;

    showPaginator?: boolean;
    pagination?: IDataTablePagination;
    onPageChange?: (page: number) => void | Promise<void>;

    // Sorting
    sort?: DataTableListOptions;
    onSort?: (sort: DataTableListOptions) => void;
  }
  let {
    columns,
    rows,
    RowComponent,
    caption,
    showPaginator = false,
    pagination,
    onPageChange,
    sort,
    onSort,
  }: Props = $props();

  function handleSort(key: string): void {
    if (!onSort) return;
    const current = sort?.sort ?? [];
    const currentKey = current[0]?.replace(/^-/, "");
    if (currentKey === key) {
      // Toggle direction
      onSort({ sort: [current[0]?.startsWith("-") ? key : `-${key}`] });
    } else {
      // New column → default DESC
      onSort({ sort: [`-${key}`] });
    }
  }
</script>

<Table.Root>
  <div class="w-full overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#each Object.entries(columns) as [columnKey, column] (columnKey)}
            <Table.Head
              class={cn("text-muted-foreground text-left font-medium", {
                "text-center": column.align === "center",
                "text-right": column.align === "right",
                "hover:text-foreground cursor-pointer select-none": column.sortable,
              })}
              onclick={column.sortable ? () => handleSort(column.key) : undefined}
              role={column.sortable ? "button" : undefined}
              tabindex={column.sortable ? 0 : undefined}
            >
              {#if column.headerComponent}
                {@const HeaderComponent = column.headerComponent}
                <HeaderComponent />
              {:else}
                {column.title}
              {/if}
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {#each rows as row, rowIndex (rowIndex)}
          {#if RowComponent}
            {@render RowComponent(row)}
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
    </Table.Root>
  </div>
</Table.Root>
<div class="mt-4 flex flex-wrap items-center gap-2">
  {#if caption}
    <small class="text-muted-foreground px-2 text-left">{caption}</small>
  {/if}

  {#if showPaginator && pagination}
    <DataTablePaginator {...pagination} {onPageChange} class="ml-auto" />
  {/if}
</div>
