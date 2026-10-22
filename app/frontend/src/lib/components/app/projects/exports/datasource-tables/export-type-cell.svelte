<script lang="ts">
  import { classifyExport } from "@/components/app/sync/exports/util/export-records";
  import { Badge } from "@/components/ui/badge";

  import { ExportRecord } from "@/data/model/sync/exports/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let kind = $derived(classifyExport(exportRecord));
</script>

{#if kind === "entry"}
  <Badge variant="default">Entry</Badge>
{:else}
  <Badge variant="default">Dataset</Badge>
{/if}
