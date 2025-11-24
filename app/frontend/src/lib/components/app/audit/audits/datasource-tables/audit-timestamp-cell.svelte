<script lang="ts">
  import DateText from "@/components/app/texts/date-text.svelte";

  import { AuditRecord } from "@/data/model/audit/audits/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: auditRecord }: DataTableCellBaseProps<AuditRecord> = $props();
</script>

<DateText size="sm" showTooltip datetime={auditRecord.timestamp as Date} datetimeFormat="yyyy-MM-dd HH:mm:ssss" />
