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

  // Variables
  let columns = $state(webhookCallLogsColumns);
</script>

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Call logs of webhook</DialogTitle>
    </DialogHeader>

    <div class="w-full overflow-auto">
      {#key $refetches.webhooks.list}
        <DatasourceTable
          id="webhook-calls"
          name="webhook-calls"
          refetchKey="webhookCalls"
          {columns}
          dataSource={webhookCallBackendDataSource(webhookRecord.id)}
          listOptions={{
            fields: {
              ["webhookCalls"]: ["id", "http_status", "created_at"],
            },
            filters: {
              id: webhookRecord.id,
            },
          }}
        ></DatasourceTable>
      {/key}
    </div>
  </DialogContent>
</Dialog>
