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

  interface TableProps {
    dataTable: DataTable[];
  }

  let { dataTable }: TableProps = $props();
</script>

<div class="w-full">
  <div class="overflow-hidden rounded-md border">
    <Table>
      {#each dataTable as data}
        <TableHeader>
          <TableRow class="*:border-border [&>:not(:last-child)]:border-r">
            {#each Object.entries(data) as [key]}
              <TableHead class="capitalize">
                {key}
              </TableHead>
            {/each}
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow class="*:border-border [&>:not(:last-child)]:border-r">
            {#each Object.entries(data) as [key, value]}
              <TableCell>
                {value}
              </TableCell>
            {/each}
          </TableRow>
        </TableBody>
      {/each}
    </Table>
  </div>
</div>
