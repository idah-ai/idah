<script lang="ts">
  import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { DropdownMenuItemBaseProps } from "@/components/app/dropdown-menus/dropdown-menu.types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  const menus: DropdownMenuItemBaseProps[] = [
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
  ];

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
    $refetches.accounts.list++;
    openConfirmDeleteAccountModal = false;
    toast.success(`${account.email} is removed!`);
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon" {...props}>
        <EllipsisVerticalIcon class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end">
    <DropdownMenuGroup>
      {#each menus as { label, icon: Icon, action }, index (index)}
        <DropdownMenuItem onclick={action}>
          <Icon class="size-4" />
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>

<AccountFormModal title="Account" action="update" {accountRecord} bind:open={openEditAccountFormModal}
></AccountFormModal>

<ConfirmModal
  title="Delete account"
  description="Are you sure you want to remove this account?"
  onConfirm={removeAccount}
  bind:open={openConfirmDeleteAccountModal}
></ConfirmModal>
