<script lang="ts" generics="T extends Record">
  import { getContext } from "svelte";

  import { TableCell, TableRow } from "@/components/ui/table";
  import Text from "@/components/ui/text/Text.svelte";

  import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";
  import type { Record } from "@/data/model/Record";

  // Contexts
  const columns: ColumnsSettings<T> = getContext("columns");
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={Object.keys(columns).length}>
    <div class="flex w-full items-center justify-center">
      <Text weight="semibold">Something went wrong.</Text>
    </div>
  </TableCell>
</TableRow>
