<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import WebhookFormModal from "@/components/app/notification/webhook/overlays/webhook-form-modal.svelte";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalChoice, confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { WebhookRecord, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    webhookId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { webhookId, align = "center" }: Props = $props();

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights(), fetchWebhook()]);
  });

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateWebhook = $state(false);
  let canDeleteWebhook = $state(false);
  let webhookRecord: WebhookRecord | undefined = $state(undefined);
  let openEditWebhookFormModal: boolean = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateWebhook,
          action: async () => {
            await fetchWebhook();
            openEditWebhookFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          destructive: true,
          hidden: !canDeleteWebhook,
          action: confirmDeleteWebhook,
        },
      ],
    },
  });

  // Functions
  async function checkRights() {
    canUpdateWebhook = (await currentAccount?.can("update", "notification:webhooks")) || false;
    canDeleteWebhook = (await currentAccount?.can("delete", "notification:webhooks")) || false;
  }

  async function fetchWebhook() {
    const webhookRes = await webhooksBackendDataSource.get(webhookId, {
      fields: {
        [WebhookRecord.type]: ["name", "url", "event_type", "secret_key"],
      },
      noCache: true,
    });
    webhookRecord = webhookRes.data;
    return webhookRecord;
  }

  async function confirmDeleteWebhook(): Promise<void> {
    const choice = await showConfirmModal({
      title: "Delete Webhook",
      description: `Are you sure you want to delete this webhook "${webhookRecord?.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await webhooksBackendDataSource.delete(webhookId, { showErrorToast: false });
          $refetches.webhooks.list = new Date();
          showToast.success({
            title: "Webhook deleted",
            description: webhookRecord
              ? `The webhook "${webhookRecord?.name}" has been deleted.`
              : "The webhook has been deleted.",
          });
        } catch (error) {
          showActionFailedToast(error);
          return confirmModalResult.KeepOpen;
        }
      },
    });
    if (choice === ConfirmModalChoice.Cancel) return;

    // Navigating inside `onConfirm` would run while the modal is still open.
    goto(resolve("/webhooks"));
  }
</script>

{#if canUpdateWebhook || canDeleteWebhook}
  <DropdownMenus {menus} {align} />

  <WebhookFormModal title="Webhook" action="update" {webhookRecord} bind:open={openEditWebhookFormModal} />
{/if}
