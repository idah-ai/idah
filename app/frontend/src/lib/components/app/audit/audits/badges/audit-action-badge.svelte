<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { AuditRecord } from "@/data/model/audit/audits/record";

  // Props
  interface Props {
    auditRecord: AuditRecord;
  }
  let { auditRecord }: Props = $props();

  // Variables
  let { label, badgeVariant } = $derived(auditRecord.actionBadge);
</script>

<Badge variant={badgeVariant}>
  {label}
</Badge>
