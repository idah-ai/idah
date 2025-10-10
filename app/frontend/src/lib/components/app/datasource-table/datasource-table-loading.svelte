<script lang="ts" generics="T extends Record">
  import { getContext } from "svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { TableCell, TableRow } from "@/components/ui/table";

  import type { ColumnsSettings } from "@/components/app/datasource-table/types";
  import type { Record } from "@/data/model/Record";

  // Contexts
  const columns: ColumnsSettings<T> = getContext("columns");
</script>

<TableRow class="h-[50vh] min-h-[50vh]">
  <TableCell colspan={Object.keys(columns).length}>
    <div class="flex w-full items-center justify-center">
      <Spinner size="lg"></Spinner>
    </div>
  </TableCell>
</TableRow>
