<script lang="ts">
  import WebhookDropdownMenu from "@/components/app/notification/webhook/dropdowns/webhook-dropdown-menu.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhookRecord }: DataTableCellBaseProps<WebhookRecord> = $props();
</script>

<WebhookDropdownMenu webhookId={webhookRecord.id} />
