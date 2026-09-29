<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  
  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";
  
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: WebhookCall }: DataTableCellBaseProps<WebhookCallRecord> = $props();
</script>

<Text>{WebhookCall.http_status}</Text>