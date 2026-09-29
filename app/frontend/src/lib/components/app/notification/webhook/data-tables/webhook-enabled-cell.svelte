<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

  import { WebhookRecord } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();

  // Variables
  let resource: string = WebhookRecord.type;

  // Functions
  async function updateWebhookStatus(): Promise<void> {}
</script>

<div class="flex items-center gap-2">
  <Switch
    id="{resource}/enabled"
    checked={webhook.enabled}
    onCheckedChange={async (checkedValue) => {
      webhook.enabled = checkedValue;
      await updateWebhookStatus();
    }}
  />

  <Label for="{resource}/enabled">Enabled</Label>
</div>
