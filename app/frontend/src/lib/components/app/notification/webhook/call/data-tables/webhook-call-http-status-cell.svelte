<script lang="ts">
  import { DotIcon } from "@lucide/svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: WebhookCall }: DataTableCellBaseProps<WebhookCallRecord> = $props();
</script>

<Text>{WebhookCall.http_status}</Text>
<div class="flex items-center gap-2">
  <DotIcon size="xl" color={WebhookCall.http_status.bgColor} />
  <Text>{WebhookCall.http_status.label}</Text>
</div>
