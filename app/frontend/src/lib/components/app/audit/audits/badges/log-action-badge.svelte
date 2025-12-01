<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";

  // Props
  interface Props {
    logRecord: LogRecord;
  }
  let { logRecord }: Props = $props();

  // Variables
  let { label, badgeVariant } = $derived(logRecord.actionBadge);
</script>

<Badge variant={badgeVariant}>
  {label}
</Badge>
