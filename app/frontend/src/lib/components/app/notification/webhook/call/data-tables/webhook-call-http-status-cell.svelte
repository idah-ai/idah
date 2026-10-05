<script lang="ts">
  import { DotIcon } from "@lucide/svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhookCall }: DataTableCellBaseProps<WebhookCallRecord> = $props();
</script>

<div class="flex items-center gap-2">
  <DotIcon size="xl" color={webhookCall.httpStatus.bgColor} />
  <Text>{webhookCall.http_code} {webhookCall.httpStatus.label}</Text>
</div>
