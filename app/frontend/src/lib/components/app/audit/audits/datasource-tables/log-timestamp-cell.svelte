<script lang="ts">
  import DateText from "@/components/app/texts/date-text.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: logRecord }: DataTableCellBaseProps<LogRecord> = $props();
</script>

<DateText size="sm" showTooltip datetime={logRecord.event_timestamp as Date} datetimeFormat="yyyy-MM-dd HH:mm:ss.SSS" />
