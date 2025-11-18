<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import OrganizationOwnersFormModal from "@/components/app/organizations/overlays/organization-owners-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Variables
  let openAddNewOrgOwnersModal: boolean = $state(false);

  // Functions
  function openAddNewOrgOwnersDialog() {
    openAddNewOrgOwnersModal = true;
  }
</script>

<Button onclick={openAddNewOrgOwnersDialog}>
  <PlusIcon />
  Add Owners
</Button>

<OrganizationOwnersFormModal title="Owners" action="create" bind:open={openAddNewOrgOwnersModal} />
