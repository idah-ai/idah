<script lang="ts">
  import TableBody from "$lib/components/ui/table/table-body.svelte";
  import TableCell from "$lib/components/ui/table/table-cell.svelte";
  import TableHead from "$lib/components/ui/table/table-head.svelte";
  import TableHeader from "$lib/components/ui/table/table-header.svelte";
  import TableRow from "$lib/components/ui/table/table-row.svelte";
  import Table from "$lib/components/ui/table/table.svelte";

  interface DataTable {
    [key: string]: string;
  }

  interface ColumnTable {
    key: string;
    label: string;
  }

  interface TableProps {
    dataTable: DataTable[];
    columns: ColumnTable[];
  }

  let { dataTable, columns }: TableProps = $props();
</script>

<div class="w-full">
  <div
    class="
      overflow-x-auto
      md:max-w-full
      md:overflow-x-auto
      lg:overflow-x-visible
    "
  >
    <div class="rounded-md border">
      <Table class="table-auto min-w-max lg:w-full">
        <!-- HEADER -->
        <TableHeader>
          <TableRow class="*:border-border [&>:not(:last-child)]:border-r">
            {#each columns as col}
              <TableHead class="whitespace-nowrap px-4">
                {col.label}
              </TableHead>
            {/each}
          </TableRow>
        </TableHeader>

        <!-- BODY -->
        <TableBody>
          {#each dataTable as row}
            <TableRow class="*:border-border [&>:not(:last-child)]:border-r">
              {#each columns as col}
                <TableCell class="whitespace-nowrap px-4">
                  {row[col.key]}
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  </div>
</div>
