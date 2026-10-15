<script lang="ts">
  import { onMount } from "svelte";

  import WebhookCallLogsContentModal from "@/components/app/notification/webhook/call/overlays/webhook-call-logs-content-modal.svelte";
  import WebhookFormModal from "@/components/app/notification/webhook/overlays/webhook-form-modal.svelte";
  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import Button from "@/components/ui/button/button.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
  import TooltipContent from "@/components/ui/tooltip/tooltip-content.svelte";
  import { ClockIcon, SquarePenIcon, Trash2Icon, WifiIcon } from "@lucide/svelte";

  import { WebhookRecord, webhookResource, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { Component } from "svelte";

  // Props
  let { record: webhookRecord }: DataTableCellBaseProps<WebhookRecord> = $props();

  // Variables
  let openEditWebhookFormModal: boolean = $state(false);
  let openCallLogsModal: boolean = $state(false);
  let currentAccount = $authStatus.authContext;
  let canReadWebhookCalls = $state(false);
  let canUpdateWebhook = $state(false);
  let canDeleteWebhook = $state(false);
  let actions: {
    label: string;
    icon: Component;
    visible: boolean;
    destructive?: boolean;
    action: () => void | Promise<void>;
  }[] = $derived([
    {
      label: "Test Webhook",
      icon: WifiIcon,
      visible: true,
      action: testWebhook,
    },
    {
      label: "Call logs",
      icon: ClockIcon,
      visible: canReadWebhookCalls,
      action: openCallLogs,
    },
    {
      label: "Edit",
      icon: SquarePenIcon,
      visible: canUpdateWebhook,
      action: openEditWebhookModal,
    },
    {
      label: "Delete",
      icon: Trash2Icon,
      visible: canDeleteWebhook,
      destructive: true,
      action: confirmDeleteWebhook,
    },
  ]);

  // Lifecycle
  onMount(async () => {
    canReadWebhookCalls = (await currentAccount?.can("read", webhookResource)) || false;
    canUpdateWebhook = (await currentAccount?.can("update", webhookResource)) || false;
    canDeleteWebhook = (await currentAccount?.can("delete", webhookResource)) || false;
  });

  async function fetchWebhook(): Promise<WebhookRecord> {
    const webhookRes = await webhooksBackendDataSource.get(webhookRecord.id, {
      fields: {
        [WebhookRecord.type]: ["name", "url", "events", "secret", "enabled"],
      },
      noCache: true,
    });
    webhookRecord = webhookRes.data;
    return webhookRecord;
  }

  function openCallLogs(): void {
    openCallLogsModal = true;
  }

  async function openEditWebhookModal(): Promise<void> {
    await fetchWebhook();
    openEditWebhookFormModal = true;
  }

  async function testWebhook(): Promise<void> {
    try {
      await webhooksBackendDataSource.test(webhookRecord.id);
      showToast.success({
        title: "Webhook tested",
        description: `The webhook "${webhookRecord.name}" has been tested successfully.`,
      });
    } catch (error) {
      console.log(error);
      showToast.error({
        title: "Unable to test webhook",
        description: error?.response?.message || "The action could not be completed, please try again later.",
      });
    }
  }

  async function confirmDeleteWebhook(): Promise<void> {
    await showConfirmModal({
      title: "Delete Webhook",
      confirmLabel: "Delete Webhook",
      description: `Are you sure you want to delete this webhook "${webhookRecord.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await webhooksBackendDataSource.delete(webhookRecord.id, { showErrorToast: false });
          $refetches.webhooks.list = new Date();
          showToast.success({
            title: "Webhook deleted",
            description: `The webhook "${webhookRecord.name}" has been deleted.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }
</script>

<div class="flex items-center gap-1">
  {#each actions as { label, icon: Icon, visible, destructive, action } (label)}
    {#if visible}
      <Tooltip>
        <TooltipTrigger class="inline-flex">
          <Button
            variant="ghost"
            size="icon"
            class={destructive ? "text-destructive hover:text-destructive" : ""}
            aria-label={label}
            onclick={action}
          >
            <Icon />
          </Button>
        </TooltipTrigger>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    {/if}
  {/each}
</div>

<WebhookFormModal title="Webhook" action="update" {webhookRecord} bind:open={openEditWebhookFormModal} />

{#if canReadWebhookCalls && openCallLogsModal}
  <WebhookCallLogsContentModal {webhookRecord} bind:open={openCallLogsModal} />
{/if}
