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

<!-- OUTER CONTAINER -->
<div class="w-full">
  <!-- SCROLL AREA -->
  <div
    class="
      overflow-x-auto
      max-w-screen-sm
      sm:max-w-full
    "
  >
    <div class="rounded-md border">
      <Table class="min-w-max table-auto">
        <!-- HEADER -->
        <TableHeader>
          <TableRow class="*:border-border [&>:not(:last-child)]:border-r">
            {#each columns as col}
              <TableHead class="whitespace-nowrap min-w-[160px]">
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
                <TableCell class="whitespace-nowrap min-w-[160px]">
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
