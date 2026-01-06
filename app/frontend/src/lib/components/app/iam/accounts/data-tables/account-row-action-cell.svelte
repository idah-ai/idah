<script lang="ts">
  import { SquarePenIcon, UserXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateAccount = $state(false);
  let canDeleteAccount = $state(false);
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
          label: "Cancel Invitation",
          icon: UserXIcon,
          hidden: !canDeleteAccount || account.joined_at,
          action: () => {
            openConfirmDeleteAccountModal = true;
          },
        },
      ],
    },
  });
  let accountRecord: AccountRecord | undefined = $state(undefined);
  let openEditAccountFormModal: boolean = $state(false);
  let openConfirmDeleteAccountModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    canUpdateAccount = (await currentAccount?.can("update", "iam:accounts", ["as_org_owner"])) || false;
    canDeleteAccount = (await currentAccount?.can("delete", "iam:accounts", ["as_org_owner"])) || false;
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

  async function removeAccount(): Promise<void> {
    await accountsBackendDataSource.delete(account.id);
    $refetches.accounts.list = new Date();
    openConfirmDeleteAccountModal = false;
    toast.success(`${account.email} is removed!`);
  }
</script>

{#if canUpdateAccount || canDeleteAccount}
  <DropdownMenus {menus} align="center" />

  <AccountFormModal title="Account" action="update" {accountRecord} bind:open={openEditAccountFormModal} />

  <ConfirmModal
    title="Delete account"
    description="Are you sure you want to remove this account?"
    onConfirm={removeAccount}
    bind:open={openConfirmDeleteAccountModal}
  />
{/if}
