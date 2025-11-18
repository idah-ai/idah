<script lang="ts">
  import { Trash2Icon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: organization }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  let openConfirmRemoveOrgOwnerModal: boolean = $state(false);

  // Functions
  async function removeOrgOwner() {
    try {
      // await organizationsBackendDataSource.delete(organization.id);
      $refetches.accounts.list = new Date();
      toast.success("Organization owner removed successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove organization owner.");
    }
  }
</script>

<Button variant="ghost" size="icon-sm" onclick={() => (openConfirmRemoveOrgOwnerModal = true)}>
  <Trash2Icon />
</Button>

<ConfirmModal
  title="Remove Organization Owner"
  description="Are you sure you want to remove this owner from the organization? This action cannot be undone."
  onConfirm={removeOrgOwner}
  bind:open={openConfirmRemoveOrgOwnerModal}
/>
