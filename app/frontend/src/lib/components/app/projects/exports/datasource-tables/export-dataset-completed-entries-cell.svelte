<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  // Exports created before this option existed have no `completed_entries` key,
  // and did include every entry of the dataset.
  let completedEntriesOnly = $derived(
    (exportRecord.job as unknown as SyncJobRecord).arguments.options?.completed_entries === true,
  );
</script>

<Badge variant={completedEntriesOnly ? "info" : "outline"}>
  {completedEntriesOnly ? "Yes" : "No"}
</Badge>
