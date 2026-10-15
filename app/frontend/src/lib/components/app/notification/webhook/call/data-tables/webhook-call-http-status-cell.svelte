<script lang="ts">
  import { DotIcon } from "@lucide/svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhookCall }: DataTableCellBaseProps<WebhookCallRecord> = $props();
</script>

<div class="flex items-center gap-1">
  <DotIcon class="size-7 shrink-0" color={webhookCall.httpStatus.bgColor} />
  <Text size="sm">{webhookCall.httpStatus.label}</Text>
</div>
