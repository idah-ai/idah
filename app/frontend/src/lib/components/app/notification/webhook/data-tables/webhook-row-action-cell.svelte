<script lang="ts">
  import WebhookFormModal from "@/components/app/notification/webhook/overlays/webhook-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
  import TooltipContent from "@/components/ui/tooltip/tooltip-content.svelte";
  import { ClockIcon, RssIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import { WebhookRecord, webhooksMemoryDataSource } from "@/data/model/notification/webhooks/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenuItem } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: webhookRecord }: DataTableCellBaseProps<WebhookRecord> = $props();

  // Variables
  let openEditWebhookFormModal: boolean = $state(false);
  let actions = [
    {
      label: "Test webhook",
      icon: RssIcon,
      action: () => {
        console.log("Test webhook clicked for webhook:", webhookRecord.id);
      },
    },
    {
      label: "Call logs",
      icon: ClockIcon,
      action: () => {
        console.log("Call logs clicked for webhook:", webhookRecord.id);
      },
    },
    {
      label: "Edit",
      icon: SquarePenIcon,
      action: async () => {
        await fetchWebhook();
        openEditWebhookFormModal = true;
      },
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      action: () => {
        console.log("Delete clicked for webhook:", webhookRecord.id);
      },
    },
  ] as IDropdownMenuItem[];

  async function fetchWebhook(): Promise<WebhookRecord> {
    const webhookRes = await webhooksMemoryDataSource.get(webhookRecord.id, {
      fields: {
        [WebhookRecord.type]: ["name", "url", "event_type", "secret_key"],
      },
      noCache: true,
    });
    webhookRecord = webhookRes.data;
    return webhookRecord;
  }
</script>

{#each actions as { label, icon: Icon, action }, actionIndex (actionIndex)}
  <Tooltip>
    <TooltipTrigger class="inline-block">
      <Button variant="ghost" size="icon" onclick={action}>
        <Icon />
      </Button>
    </TooltipTrigger>

    <TooltipContent>
      {label}
    </TooltipContent>
  </Tooltip>
{/each}

<WebhookFormModal title="Webhook" action="update" {webhookRecord} bind:open={openEditWebhookFormModal} />
