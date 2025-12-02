<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";
  import { humanize } from "@/utils/string";

  // Props
  interface Props {
    logRecord: LogRecord;
  }
  let { logRecord }: Props = $props();
</script>

<Badge variant="outline">
  {humanize(logRecord.action)}
</Badge>
