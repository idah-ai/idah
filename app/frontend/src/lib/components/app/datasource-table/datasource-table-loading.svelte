<script lang="ts">
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { TableCell, TableRow } from "@/components/ui/table";

  // Props
  let { columnSpan }: { columnSpan: number } = $props();
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={columnSpan}>
    <div class="flex w-full items-center justify-center">
      <Spinner size="lg"></Spinner>
    </div>
  </TableCell>
</TableRow>
