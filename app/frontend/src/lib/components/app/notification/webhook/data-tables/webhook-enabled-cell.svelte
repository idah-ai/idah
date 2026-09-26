<script lang="ts">
  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Badge from "@/components/ui/badge/badge.svelte";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();
</script>

<Badge variant={webhook.enabled ? "success" : "destructive"}>
  {webhook.enabled ? "Enabled" : "Disabled"}
</Badge>
