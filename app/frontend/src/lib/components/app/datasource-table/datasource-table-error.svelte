<script lang="ts">
  import { TableCell, TableRow } from "@/components/ui/table";
  import Text from "@/components/ui/text/Text.svelte";

  // Props
  let { columnSpan }: { columnSpan: number } = $props();
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={columnSpan}>
    <div class="flex w-full items-center justify-center">
      <Text weight="semibold">Something went wrong.</Text>
    </div>
  </TableCell>
</TableRow>
