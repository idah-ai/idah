<script lang="ts">
  import { CircleSlashIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ApiKeyFormModal from "@/components/app/iam/api-keys/overlays/api-key-form-modal.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: apiKey }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateAPIKey = $state(false);
  let canDeleteAPIKey = $state(false);
  let alreadyRevoked = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateAPIKey || alreadyRevoked,
          action: async () => {
            const apiKeyRes = await fetchAPIKey();
            apiKeyRecord = apiKeyRes.data;

            openEditAPIKeyFormModal = true;
          },
        },
        {
          label: "Revoke",
          icon: CircleSlashIcon,
          hidden: !canUpdateAPIKey || alreadyRevoked,
          action: confirmRevokeAPIKey,
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          hidden: !canDeleteAPIKey,
          action: confirmRemoveAPIKey,
        },
      ],
    },
  });
  let apiKeyRecord: ApiKeyRecord | undefined = $state(undefined);
  let openEditAPIKeyFormModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    const apiRes = await fetchAPIKey();

    canUpdateAPIKey = (await currentAccount?.can("update", "iam:api_keys")) || false;

    // canRevokeAPIKey = (await currentAccount?.can("revoke", "iam:api_keys")) || false;
    canDeleteAPIKey = (await currentAccount?.can("delete", "iam:api_keys")) || false;

    alreadyRevoked = apiRes.data.status === "revoked";
  });

  // Functions
  async function fetchAPIKey() {
    return await apiKeysBackendDataSource.get(apiKey.id, {
      fields: {
        [ApiKeyRecord.type]: ["name", "scope_type", "scope_value", "expires_at", "permissions", "status"],
      },
      noCache: true,
    });
  }

  async function confirmRemoveAPIKey(): Promise<void> {
    await showConfirmModal({
      title: "Delete API Key",
      confirmLabel: "Delete API Key",
      description: `Are you sure you want to delete this API key "${apiKey.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await apiKeysBackendDataSource.delete(apiKey.id, { showErrorToast: false });

          $refetches.apiKeys.list = new Date();
          showToast.success({
            title: "API Key deleted",
            description: `The API key "${apiKey.name}" has been deleted.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }

  async function confirmRevokeAPIKey(): Promise<void> {
    await showConfirmModal({
      title: "Revoke API Key",
      confirmLabel: "Revoke API Key",
      description: `Are you sure you want to revoke this API key "${apiKey.name}"?\nRevoking this key will immediately block all requests that use it. Any applications, integrations, or services relying on this key will stop working.`,
      onConfirm: async () => {
        try {
          await apiKeysBackendDataSource.revoke({ id: apiKey.id });

          $refetches.apiKeys.list = new Date();
          showToast.success({
            title: "API Key revoked",
            description: `The API key "${apiKey.name}" has been revoked.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }
</script>

{#if canUpdateAPIKey || canDeleteAPIKey}
  <DropdownMenus {menus} align="center" />

  <ApiKeyFormModal title="API Key" action="update" {apiKeyRecord} bind:open={openEditAPIKeyFormModal} />
{/if}
