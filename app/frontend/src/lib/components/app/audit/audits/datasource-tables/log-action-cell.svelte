<script lang="ts">
  import LogActionBadge from "@/components/app/audit/audits/badges/log-action-badge.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: logRecord }: DataTableCellBaseProps<LogRecord> = $props();
</script>

<LogActionBadge {logRecord} />
