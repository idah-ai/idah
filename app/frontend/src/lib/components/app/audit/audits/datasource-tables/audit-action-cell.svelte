<script lang="ts">
  import AuditActionBadge from "@/components/app/audit/audits/badges/audit-action-badge.svelte";

  import { AuditRecord } from "@/data/model/audit/audits/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: auditRecord }: DataTableCellBaseProps<AuditRecord> = $props();
</script>

<AuditActionBadge {auditRecord} />
