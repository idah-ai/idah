<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import { webhookCallLogsColumns } from "@/components/app/notification/webhook/call/data-tables/webhook-call-logs-columns";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { WebhookRecord, webhooksMemoryDataSource } from "@/data/model/notification/webhooks/record";
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
          id="webhooks"
          name="webhooks"
          refetchKey="webhooks"
          {columns}
          dataSource={webhooksMemoryDataSource}
          listOptions={{
            fields: {
              ["webhooks"]: ["id", "name", "url", "event_types", "enabled", "created_at"],
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
