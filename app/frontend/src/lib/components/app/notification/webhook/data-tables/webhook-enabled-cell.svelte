<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";

  import { WebhookRecord, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhook }: DataTableCellBaseProps<WebhookRecord> = $props();

  // Variables
  let resource: string = WebhookRecord.type;

  // Functions
  async function updateWebhookStatus(checkedValue: boolean): Promise<void> {
    const previousValue = webhook.enabled;
    webhook.enabled = checkedValue;

    try {
      await webhooksBackendDataSource.update(
        webhook.id,
        {
          attributes: {
            enabled: checkedValue,
          },
        },
        { showErrorToast: false },
      );
      $refetches.webhooks.list = new Date();
    } catch (error) {
      webhook.enabled = previousValue;
      showActionFailedToast(error);
    }
  }
</script>

<div class="flex items-center gap-2">
  <Switch
    id="{resource}/enabled"
    checked={webhook.enabled}
    onCheckedChange={async (checkedValue) => {
      await updateWebhookStatus(checkedValue);
    }}
  />

  <Label for="{resource}/enabled">Enabled</Label>
</div>
