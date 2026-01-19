<script lang="ts">
  import { RotateCcwIcon, SquarePenIcon, UserXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { projectMembersBasePath } from "@/data/model/dataset/projects/members/record";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateAccount = $state(false);
  let canResentInvitation = $state(false);
  let canCancelInvitation = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateAccount,
          action: async () => {
            const accountRes = await fetchAccount();
            accountRecord = accountRes.data;

            openEditAccountFormModal = true;
          },
        },
        {
          label: "Resend Invitation",
          icon: RotateCcwIcon,
          hidden: !canResentInvitation,
          action: resendInvitation,
        },
        {
          label: "Cancel Invitation",
          icon: UserXIcon,
          hidden: canCancelInvitation,
          action: () => {
            openConfirmCancelInvitationModal = true;
          },
        },
      ],
    },
  });
  let accountRecord: AccountRecord | undefined = $state(undefined);
  let openEditAccountFormModal: boolean = $state(false);
  let openConfirmCancelInvitationModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    canUpdateAccount = (await currentAccount?.can("update", "iam:accounts", ["as_org_owner"])) || false;

    const alreadyJoined = account.joined_at !== null;
    canResentInvitation = !alreadyJoined;
    canCancelInvitation = alreadyJoined;
  });

  // Functions
  async function fetchAccount() {
    return await accountsBackendDataSource.get(account.id, {
      fields: {
        "iam:accounts": ["name", "email", "enabled", "role_name", "sso_channel"],
      },
      noCache: true,
    });
  }

  async function resendInvitation() {
    try {
      await accountsBackendDataSource.resend_invitation({ id: account.id });
      $refetches.accounts.list = new Date();
      toast.success("Invitation resent", {
        description: `The account invitation for "${account.email}" has been resent.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function removeAccount(): Promise<void> {
    try {
      await accountsBackendDataSource.delete(account.id, { showErrorToast: false });

      // Delete project member cache to force refetch
      clearCache(resourcePath(projectMembersBasePath, null, undefined));

      openConfirmCancelInvitationModal = false;
      $refetches.accounts.list = new Date();
      toast.success("Invitation cancelled", {
        description: `The account invitation for "${account.email}" has been cancelled.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }
</script>

{#if canUpdateAccount || canCancelInvitation}
  <DropdownMenus {menus} align="center" />

  <AccountFormModal title="Account" action="update" {accountRecord} bind:open={openEditAccountFormModal} />

  <ConfirmModal
    title="Cancel Invitation"
    description={`Are you sure you want to cancel invitation for "${account.email}"?`}
    onConfirm={removeAccount}
    bind:open={openConfirmCancelInvitationModal}
  />
{/if}
