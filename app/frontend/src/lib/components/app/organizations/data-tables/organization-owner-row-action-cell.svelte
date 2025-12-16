<script lang="ts">
  import { page } from "$app/state";
  import { UserRoundXIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Can from "@/security/can.svelte";

  // Props
  let { record: accountRecord }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  let organizationId = page.params.organizationId as string;
  let openConfirmRemoveOrgOwnerModal: boolean = $state(false);
  let { id: accountId, email } = $derived(accountRecord);

  // Functions
  async function removeOrgOwner() {
    try {
      const { data: account } = await accountsBackendDataSource.get(accountId, {
        noCache: true,
      });

      /** If account is admin, skip */
      if (account.role_name === "admin") return;

      /** If org in role_scope is empty after remove organizationId, change role_name from "org_owner" to "user" */
      /** Remove organizationId from account role_scope */
      const updatedOrgRoleScope = (account.role_scope?.org || []).filter((scope) => scope !== String(organizationId));

      if (updatedOrgRoleScope.length === 0) {
        account.role_name = "user";
      }

      account.role_scope = {
        ...account.role_scope,
        org: updatedOrgRoleScope,
      };

      await accountsBackendDataSource.update(account.id, {
        attributes: {
          role_name: account.role_name,
          role_scope: account.role_scope,
        },
      });

      $refetches.accounts.list = new Date();
      toast.success("Organization owner removed successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove organization owner.");
    }
  }
</script>

<Can action="delete" resource="iam:organizations" scopes={["as_org_owner"]}>
  <Button variant="ghost" size="icon-sm" onclick={() => (openConfirmRemoveOrgOwnerModal = true)}>
    <UserRoundXIcon />
  </Button>

  <ConfirmModal
    title="Remove Organization Owner"
    description="Are you sure you want to remove {email} from the organization owner? This action cannot be undone."
    onConfirm={removeOrgOwner}
    bind:open={openConfirmRemoveOrgOwnerModal}
  />
</Can>
