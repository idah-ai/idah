<script lang="ts">
  import { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { ExportFormat } from "@/data/model/sync/exports/type";

  // Props
  let { record: exportRecord, contexts }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let { exportFormats } = contexts as { exportFormats: ExportFormat[] };

  let syncJobExporter = $derived((exportRecord.job as unknown as SyncJobRecord).arguments.exporter);
  let exporter = $derived(exportFormats.find((format) => format.exporter === syncJobExporter));
</script>

{exporter?.name ?? humanize(syncJobExporter)}
