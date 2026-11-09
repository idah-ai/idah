<script lang="ts">
  import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
  import AppTableHeader from "@/components/app/table/tableHeader.svelte";

  // Props
  let { entryName }: { entryName: string } = $props();

  // Variables
  const columns = [{ label: "Stage" }, { label: "Submitted by" }, { label: "Time spent", class: "text-right" }];
</script>

<div class="bg-muted rounded-lg px-3 py-1">
  <Table aria-label={"Workflow stage details for " + entryName}>
    <AppTableHeader {columns} />
    <TableBody>
      <TableRow class="last:border-0">
        <TableCell colspan={columns.length} class="text-muted-foreground py-4 text-sm whitespace-normal">
          Stage details and recorded time are not available for this entry yet.
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
