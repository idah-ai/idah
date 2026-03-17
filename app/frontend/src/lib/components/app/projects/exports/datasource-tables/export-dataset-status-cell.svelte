<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let syncJobRecord = $derived(exportRecord.job as unknown as SyncJobRecord);
</script>

<Badge variant={syncJobRecord.statusBadge.variant}>
  {syncJobRecord.statusBadge.label}
</Badge>
