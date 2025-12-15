<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import OrganizationOwnersFormModal from "@/components/app/organizations/overlays/organization-owners-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  // Variables
  let openAddNewOrgOwnersModal: boolean = $state(false);

  // Functions
  function openAddNewOrgOwnersDialog() {
    openAddNewOrgOwnersModal = true;
  }
</script>

<Can action="update" resource="iam:accounts">
  <Button onclick={openAddNewOrgOwnersDialog}>
    <PlusIcon />
    Add Organization Owners
  </Button>

  <OrganizationOwnersFormModal title="Organization Owners" action="create" bind:open={openAddNewOrgOwnersModal} />
</Can>
