<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import DatasetFormModal from "@/components/app/datasets/overlays/dataset-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  // Variables
  let projectId = page.params.projectId as string;
  let openNewDatasetModal: boolean = $state(false);

  // Functions
  function openNewDatasetDialog(): void {
    openNewDatasetModal = true;
  }
</script>

<Can
  action="create"
  resource="dataset:datasets"
  scopes={[
    "as_org_owner",
    {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    },
  ]}
>
  <Button onclick={openNewDatasetDialog}>
    <PlusIcon />
    New Dataset
  </Button>

  <DatasetFormModal title="Dataset" action="create" bind:open={openNewDatasetModal} />
</Can>
