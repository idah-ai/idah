<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let openAddNewProjectModal: boolean = $state(false);

  // Functions
  function openAddNewProjectDialog() {
    openAddNewProjectModal = true;
  }
</script>

<Can action="create" resource="dataset:projects" scopes={["as_org_owner"]}>
  <Button onclick={openAddNewProjectDialog}>
    <PlusIcon />
    Add Project
  </Button>

  <ProjectFormModal
    title="Project"
    action="create"
    preSelectedOrganizationId={organizationId}
    bind:open={openAddNewProjectModal}
  />
</Can>
