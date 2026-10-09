<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import { webhookCallLogsColumns } from "@/components/app/notification/webhook/call/data-tables/webhook-call-logs-columns";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

  import { webhookCallBackendDataSource } from "@/data/model/notification/webhooks/call/record";
  import { WebhookRecord } from "@/data/model/notification/webhooks/record";
  import { refetches } from "@/utils/refetch";

  import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";

  // Props
  interface Props extends ModalBaseProps {
    webhookRecord: WebhookRecord;
  }
  let { open = $bindable(), webhookRecord }: Props = $props();
</script>

<Dialog bind:open>
  <DialogContent class="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Call logs of webhook</DialogTitle>
    </DialogHeader>

    <div class="w-full overflow-auto">
      {#key $refetches.webhookCalls.list}
        <DatasourceTable
          id="webhook-calls"
          name="webhook-calls"
          refetchKey="webhookCalls"
          columns={webhookCallLogsColumns}
          dataSource={webhookCallBackendDataSource(webhookRecord.id)}
          listOptions={{
            fields: {
              ["notification:webhook:calls"]: ["id", "http_code", "created_at"],
            },
            filters: {
              webhook_id: webhookRecord.id,
            },
          }}
        ></DatasourceTable>
      {/key}
    </div>
  </DialogContent>
</Dialog>
