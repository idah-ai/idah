<script lang="ts">
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: async () => {
            const accountRes = await fetchAccount();
            accountRecord = accountRes.data;
            openEditAccountFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          action: () => {
            openConfirmDeleteAccountModal = true;
          },
        },
      ],
    },
  };
  let accountRecord: AccountRecord | undefined = $state(undefined);
  let openEditAccountFormModal: boolean = $state(false);
  let openConfirmDeleteAccountModal: boolean = $state(false);

  // Functions
  async function fetchAccount() {
    return await accountsBackendDataSource.get(account.id, {
      fields: {
        "iam:accounts": ["name", "email", "enabled", "sso_channel"],
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

<DropdownMenus {menus} align="center" />

<AccountFormModal title="Account" action="update" {accountRecord} bind:open={openEditAccountFormModal} />

<ConfirmModal
  title="Delete account"
  description="Are you sure you want to remove this account?"
  onConfirm={removeAccount}
  bind:open={openConfirmDeleteAccountModal}
/>
